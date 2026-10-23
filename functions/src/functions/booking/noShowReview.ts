// Admin no-show review (fresh, local prep). A booking the close-time sweep
// auto-cancelled as a no-show lands here with its fee recorded as due and any
// captured money still held — this flow resolves it EXPLICITLY:
//
//  - recordNoShowContact: appends a validated, rate-limited contact note.
//  - previewNoShowResolution: computes the candidate charges under the
//    owner-delegated policy direction (Rs 100 or 20% on no-shows, rest
//    refunded — WhatsApp 22 Oct 21:22:57/21:23:58). WHICH of the two applies
//    is NOT settled, so this returns both candidates plus waiver and never
//    picks one.
//  - resolveNoShow: the admin passes the exact chargePaise (one of the
//    preview candidates or another explicit value) with a reason. Money moves
//    only through the refund outbox reservation — never inline.
//
// Held: capacity-checked slot reopen (the missed booking is CANCELLED and the
// reschedule machinery requires CONFIRMED; a truthful reopen needs its own
// reviewed path) and the studio-cancel compensation payout route.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { reserveRefund, refundablePaise } from "../../lib/refund-outbox.js";

const NO_SHOW_FLAT_PAISE = 10000; // Rs 100
const NO_SHOW_PCT = 0.2; // 20%

const contactSchema = z.object({
  bookingId: z.string().min(1),
  channel: z.enum(["phone", "whatsapp", "in_person"]),
  note: z.string().trim().min(3).max(500),
}).strict();

const previewSchema = z.object({ bookingId: z.string().min(1) }).strict();

const resolveSchema = z.object({
  bookingId: z.string().min(1),
  resolution: z.enum(["charge", "waive", "reopen"]),
  // Exact charge in paise for resolution=charge. Explicit on purpose: the
  // flat-vs-percentage choice within the delegated policy is unresolved, so
  // the server never selects it silently.
  chargePaise: z.number().int().min(0).nullish(),
  reason: z.string().trim().min(3).max(500),
}).strict();

interface NoShowContext {
  booking: Booking & { id: string };
  payment: Payment | null;
}

async function loadNoShow(db: FirebaseFirestore.Firestore, bookingId: string): Promise<NoShowContext> {
  const snap = await db.collection(COLLECTIONS.bookings()).doc(bookingId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = { ...(snap.data() as Booking), id: snap.id };
  if (booking.status !== "CANCELLED" || !booking.missedAt) {
    throw new HttpsError("failed-precondition", "Only a booking auto-cancelled as a no-show can be reviewed here.");
  }
  let payment: Payment | null = null;
  const pq = await db.collection(COLLECTIONS.payments()).where("bookingId", "==", bookingId).limit(1).get();
  if (!pq.empty) payment = pq.docs[0]!.data() as Payment;
  return { booking, payment };
}

function assertAdmin(user: ReturnType<typeof extractUser>) {
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required for no-show review.");
  }
}

export const recordNoShowContact = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(contactSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const { booking } = await loadNoShow(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const now = new Date().toISOString();
  const entry = { at: now, by: user.uid, channel: data.channel, note: data.note };
  await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).update({
    noShowContactLog: [...((booking as { noShowContactLog?: unknown[] }).noShowContactLog ?? []), entry],
    updatedAt: now,
  });
  return { recorded: true, at: now };
});

export const previewNoShowResolution = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(previewSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const { booking, payment } = await loadNoShow(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const captured = payment && payment.status === "completed" ? payment.amount : 0;
  return {
    bookingId: data.bookingId,
    capturedPaise: captured,
    // Delegated policy direction, both readings surfaced; the choice between
    // them is an owner-pending value, so nothing here is preselected.
    candidates: [
      { key: "flat_rs100", chargePaise: Math.min(NO_SHOW_FLAT_PAISE, captured), refundPaise: Math.max(0, captured - NO_SHOW_FLAT_PAISE) },
      { key: "pct_20", chargePaise: Math.round(captured * NO_SHOW_PCT), refundPaise: captured - Math.round(captured * NO_SHOW_PCT) },
      { key: "waive", chargePaise: 0, refundPaise: captured },
    ],
    policyNote: "Studio no-show policy: charge Rs 100 or 20% and refund the rest. Pick which one applies to this booking.",
  };
});

export const resolveNoShow = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertAdmin(user);
  const data = validate(resolveSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.noshow");
  const db = getFirestore();
  const { booking, payment } = await loadNoShow(db, data.bookingId);
  assertTenant(user, booking.tenantId);
  assertStudio(user, booking.studioId, "Booking");
  const now = new Date().toISOString();

  if (data.resolution === "reopen") {
    // Held: the missed booking is CANCELLED and the reschedule machinery only
    // moves CONFIRMED bookings. A truthful, capacity-checked reopen needs its
    // own reviewed path rather than a shortcut around cancel state.
    throw new HttpsError("failed-precondition", "Reopen is held: rebook the customer through the normal booking flow so capacity is checked there.");
  }

  if ((booking as { noShowResolution?: string }).noShowResolution) {
    throw new HttpsError("already-exists", "This no-show is already resolved.");
  }

  const charge = data.resolution === "waive" ? 0 : (data.chargePaise ?? null);
  if (charge === null) throw new HttpsError("invalid-argument", "chargePaise is required for a charge resolution.");

  let refundRequestId: string | null = null;
  if (payment && payment.status === "completed") {
    const captured = payment.amount;
    if (charge > captured) throw new HttpsError("invalid-argument", "Charge exceeds the captured amount.");
    const refund = captured - charge;
    if (refund > 0) {
      if (payment.method !== "razorpay_payment_link") {
        throw new HttpsError("failed-precondition", "Manual-payment refunds settle outside the provider; record them through the held manual flow.");
      }
      if (refund > refundablePaise(payment)) throw new HttpsError("failed-precondition", "Refund exceeds the refundable balance.");
      try {
        refundRequestId = (await reserveRefund(db, {
          payment, amountPaise: refund, reason: `No-show resolution (${data.resolution}): ${data.reason}`, createdBy: user.uid,
        })).requestId;
      } catch (err) {
        throw new HttpsError("failed-precondition", err instanceof Error ? err.message : "Could not reserve refund.");
      }
    }
  }

  await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).update({
    noShowResolution: data.resolution,
    noShowChargePaise: charge,
    noShowResolvedAt: now,
    noShowResolvedBy: user.uid,
    noShowReason: data.reason,
    ...(refundRequestId ? { noShowRefundRequestId: refundRequestId, refundStatus: "reserved" } : {}),
    cancellationFeeStatus: data.resolution === "waive" ? "waived" : "withheld",
    updatedAt: now,
  });

  const dbTx = await db.runTransaction(async (tx) => {
    writeAuditLog(tx, {
      action: "booking.noshow_resolved",
      entityType: "Booking",
      entityId: data.bookingId,
      user,
      studioId: booking.studioId,
      after: { resolution: data.resolution, chargePaise: charge, refundRequestId, reason: data.reason },
    });
    return true;
  });
  void dbTx;

  return { resolved: true, resolution: data.resolution, chargePaise: charge, refundRequestId };
});

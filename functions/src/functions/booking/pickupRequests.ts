import { onCall, HttpsError } from "firebase-functions/v2/https";
import { pickupBlockedByBooking } from "../../lib/pickup-booking-guard";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { applyPickupFees, legFees } from "../../lib/pickup-fee.js";
import { membershipForFreePickup } from "../../lib/pickup-benefit.js";
import { pickupZone, pickupFeePaise, type Booking, type Invoice, type ServiceJob, type Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { studioLocalToIso } from "../../lib/studio-time.js";

// Customer preference only - never a promised slot. The studio agrees the
// actual time with the customer by phone call and enters it on approval
// (agreedPickupAt / agreedDropAt), which is stored separately so the
// original request is never overwritten. Legacy requests may carry only the
// free-text preferredTime; all fields stay optional so those keep working.
const requestSchema = z.object({
  bookingId: z.string().min(1),
  kind: z.enum(["pickup", "drop", "both"]),
  address: z.string().trim().min(8).max(300),
  preferredTime: z.string().trim().max(100).optional(),
  requestedPickupTime: z.string().trim().max(100).optional(),
  requestedDropTime: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional(),
  // Optional device location. When sent, the server checks the free zone itself. Without it the studio checks by phone.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).strict().refine((d) => (d.lat === undefined) === (d.lng === undefined), "Send both latitude and longitude.");

const updateSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(["REQUESTED", "CONFIRMED", "DONE", "DECLINED"]),
  staffNote: z.string().trim().max(300).optional(),
  agreedPickupAt: z.string().trim().max(60).optional(),
  agreedDropAt: z.string().trim().max(60).optional(),
  /** Admin only, and only when the customer sent no pin (fee unknown). Total fee in paise for the whole request. */
  feePaise: z.number().int().min(0).max(100000).optional(),
  /**
   * Studio/admin marks one leg of the journey physically done (car collected
   * / car returned). Server stamps the time; the client never sends one.
   * Pure progress visibility: it does not change the request status (DONE
   * stays a separate manual step), does not touch pricing, and never marks
   * the job DELIVERED or charges anything. A completed leg cannot be
   * reopened - there is no unset path.
   */
  markLegCompleted: z.enum(["pickup", "drop"]).optional(),
}).strict();

interface PickupRequestDoc {
  tenantId: string;
  studioId: string;
  kind: "pickup" | "drop" | "both";
  status: "REQUESTED" | "CONFIRMED" | "DONE" | "DECLINED";
  staffNote: string;
  agreedPickupAt: string | null;
  agreedDropAt: string | null;
  bookingId?: string;
  feePaise?: number | null;
  feeBilled?: boolean;
  customerId?: string;
  /** Set when a member free pickup paid for this request: the fee is waived and the membership is charged one pickup. */
  memberMembershipId?: string | null;
  /** Server-stamped when staff marked the pickup leg (car collected) done. Null until then; never unset once set. */
  pickupCompletedAt?: string | null;
  /** Server-stamped when staff marked the drop leg (car returned) done. Null until then; never unset once set. */
  dropCompletedAt?: string | null;
}


async function studioTimezone(db: FirebaseFirestore.Firestore, studioId: string): Promise<string> {
  const snap = await db.collection(COLLECTIONS.studioConfig()).doc(studioId).get();
  const tz = (snap.data() as { timezone?: string } | undefined)?.timezone;
  return tz || "Asia/Kolkata";
}

/** Customer asks the studio to collect and/or return the car. A request only: the studio confirms or declines. New, additive. */
export const requestPickupDrop = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  assertTenant(user, user.claims.tenantId);
  const data = validate(requestSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "pickup.request");
  let distanceKm: number | null = null;
  // The fee is decided here from the distance. null = no location sent, so the studio confirms the distance and fee by phone.
  let feePaise: number | null = null;
  if (data.lat !== undefined && data.lng !== undefined) {
    const zone = pickupZone({ lat: data.lat, lng: data.lng });
    distanceKm = zone.km;
    feePaise = pickupFeePaise(zone.km, data.kind);
  }
  const db = getFirestore();
  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");
  const booking = bookingSnap.data() as Booking;
  assertTenant(user, booking.tenantId);
  if (booking.customerId !== user.uid) throw new HttpsError("permission-denied", "That is not your booking.");
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED" || booking.status === "EXPIRED") {
    throw new HttpsError("failed-precondition", "This booking is closed, so pickup and drop cannot be requested.");
  }
  const ref = db.collection(COLLECTIONS.pickupRequests()).doc(`${data.bookingId}`);
  const now = new Date().toISOString();
  const doc = {
    id: ref.id,
    tenantId: booking.tenantId,
    studioId: booking.studioId,
    bookingId: data.bookingId,
    customerId: user.uid,
    kind: data.kind,
    address: data.address,
    preferredTime: data.preferredTime ?? "",
    requestedPickupTime: data.requestedPickupTime ?? "",
    requestedDropTime: data.requestedDropTime ?? "",
    note: data.note ?? "",
    distanceKm,
    feePaise,
    status: "REQUESTED" as const,
    staffNote: "",
    agreedPickupAt: null,
    agreedDropAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists && (existing.data() as { status: string }).status !== "DECLINED") {
      throw new HttpsError("already-exists", "A pickup request is already open for this booking.");
    }
    tx.set(ref, doc);
    writeAuditLog(tx, { action: "pickup.requested", entityType: "PickupRequest", entityId: ref.id, user, studioId: booking.studioId, after: { kind: data.kind } });
  });
  return { request: doc };
});

/** Studio or admin confirms, completes or declines a pickup request. New, additive. */
export const updatePickupRequest = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(updateSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "pickup.update");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.pickupRequests()).doc(data.requestId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Request not found.");
    const cur = snap.data() as PickupRequestDoc;
    assertTenant(user, cur.tenantId);
    if (user.claims.role === "studio" && user.claims.studioId !== cur.studioId) throw new HttpsError("permission-denied", "Different studio.");

    // One way forward only: REQUESTED -> CONFIRMED or DECLINED, CONFIRMED -> DONE or DECLINED. DONE and DECLINED are final,
    // so a free pickup is handed back at most once and a closed request cannot be revived.
    const NEXT: Record<string, string[]> = { REQUESTED: ["CONFIRMED", "DECLINED"], CONFIRMED: ["DONE", "DECLINED"], DONE: [], DECLINED: [] };
    if (data.status !== cur.status && !(NEXT[cur.status] ?? []).includes(data.status)) {
      throw new HttpsError("failed-precondition", `A ${cur.status.toLowerCase()} request cannot be changed to ${data.status.toLowerCase()}.`);
    }
    if (data.feePaise !== undefined) {
      if (user.claims.role !== "admin" && user.claims.role !== "superadmin") throw new HttpsError("permission-denied", "Only an admin can set the pickup fee.");
      if (cur.feePaise !== null && cur.feePaise !== undefined) throw new HttpsError("failed-precondition", "The fee was already worked out from the customer's pin.");
      if (cur.status !== "REQUESTED") throw new HttpsError("failed-precondition", "Set the fee before confirming the request.");
    }
    const curFeePaise = data.feePaise ?? cur.feePaise ?? null;
    if ((data.status === "CONFIRMED" || data.status === "DONE") && cur.bookingId) {
      const bk = (await tx.get(db.collection(COLLECTIONS.bookings()).doc(cur.bookingId))).data() as Booking | undefined;
      if (pickupBlockedByBooking(bk?.status)) throw new HttpsError("failed-precondition", bk ? "This booking is closed, so the request can only be declined." : "No booking was found for this request, so it can only be declined.");
    }

    // Agreed timing comes from the phone call with the customer. Confirming
    // a service requires a valid agreed date/time for that service -
    // supplied now, or already stored from an earlier confirmation (so a
    // repeat approval click is idempotent rather than an error).
    let agreedPickupAt = cur.agreedPickupAt ?? null;
    let agreedDropAt = cur.agreedDropAt ?? null;
    if (data.agreedPickupAt !== undefined || data.agreedDropAt !== undefined) {
      const tz = await studioTimezone(db, cur.studioId);
      if (data.agreedPickupAt !== undefined) agreedPickupAt = studioLocalToIso(data.agreedPickupAt, tz, "Agreed pickup time");
      if (data.agreedDropAt !== undefined) agreedDropAt = studioLocalToIso(data.agreedDropAt, tz, "Agreed dropoff time");
    }

    if (data.status === "CONFIRMED") {
      // Unpriced guard: feePaise is null when the customer sent no location
      // pin and no admin has priced the request yet. Confirming in that
      // state silently bills Rs 0 (legFees(null) -> {0,0}) even though the
      // real fee is unknown - the distance tier (Rs 100/leg under 3 km,
      // Rs 150/leg beyond, per packages/core pickup-zone) was never
      // determined. An explicit fee of 0 can only come from an admin
      // deliberately pricing the request free (pin-computed fees are always
      // > 0), and member free pickups only ever apply to a known fee > 0,
      // so neither is affected. The admin prices the request first
      // (feePaise is accepted only while status is REQUESTED), then staff
      // confirm.
      if (curFeePaise === null || curFeePaise === undefined) {
        throw new HttpsError(
          "failed-precondition",
          "This pickup request has no fee yet because the customer sent no location pin. An admin must set the fee in the admin app before the request can be confirmed - do not confirm it as free.",
        );
      }
      const needsPickup = cur.kind === "pickup" || cur.kind === "both";
      const needsDrop = cur.kind === "drop" || cur.kind === "both";
      if (needsPickup && !agreedPickupAt) {
        throw new HttpsError("invalid-argument", "Enter the pickup time agreed with the customer on the call before confirming.");
      }
      if (needsDrop && !agreedDropAt) {
        throw new HttpsError("invalid-argument", "Enter the dropoff time agreed with the customer on the call before confirming.");
      }
    }

    const staffNote = data.staffNote ?? cur.staffNote ?? "";
    const now = new Date().toISOString();

    // Per-leg progress (additive visibility only - see the schema comment).
    // Allowed only on an open, confirmed request: a REQUESTED request has
    // nothing in motion yet, and a DONE/DECLINED request is closed, so legs
    // on it can neither progress nor be reopened. Re-marking a completed leg
    // is an idempotent no-op that keeps the original server timestamp.
    let pickupCompletedAt = cur.pickupCompletedAt ?? null;
    let dropCompletedAt = cur.dropCompletedAt ?? null;
    let legChanged = false;
    if (data.markLegCompleted !== undefined) {
      if (cur.status !== "CONFIRMED") {
        throw new HttpsError("failed-precondition", "Legs can only be marked completed on a confirmed, still-open request.");
      }
      if (data.markLegCompleted === "pickup") {
        if (cur.kind === "drop") throw new HttpsError("invalid-argument", "This request has no pickup leg.");
        if (!pickupCompletedAt) { pickupCompletedAt = now; legChanged = true; }
      } else {
        if (cur.kind === "pickup") throw new HttpsError("invalid-argument", "This request has no drop leg.");
        if (!dropCompletedAt) { dropCompletedAt = now; legChanged = true; }
      }
    }

    // No-op guard: identical status with no new note, timing or leg changes
    // writes nothing and adds no audit entry, so repeated approval clicks
    // cannot fan out duplicate customer notifications.
    if (
      cur.status === data.status &&
      staffNote === cur.staffNote &&
      agreedPickupAt === cur.agreedPickupAt &&
      agreedDropAt === cur.agreedDropAt &&
      data.feePaise === undefined &&
      !legChanged
    ) {
      return { requestId: data.requestId, status: data.status, idempotent: true, pickupCompletedAt, dropCompletedAt };
    }

    // Fee on the visit's price. Added when the studio confirms, taken off if it is declined. Never touches a job that already
    // has a live invoice or any payment: those amounts are fixed, so the fee is flagged "not billed" for the studio to handle.
    let feeBilled = cur.feeBilled ?? false;
    const wantFee = data.status === "CONFIRMED" || data.status === "DONE";
    // Member free pickup: a request that has a fee uses one free pickup if the customer has one. Decided once (when first
    // confirmed) and kept on repeat clicks; given back if the request is declined.
    let memberMembershipId = cur.memberMembershipId ?? null;
    const memberRows = wantFee && !memberMembershipId && (curFeePaise ?? 0) > 0 && cur.customerId
      ? await tx.get(db.collection(COLLECTIONS.memberships()).where("customerId", "==", cur.customerId).where("status", "==", "active"))
      : null;
    const heldRef = memberMembershipId ? db.collection(COLLECTIONS.memberships()).doc(memberMembershipId) : null;
    const heldSnap = heldRef && data.status === "DECLINED" ? await tx.get(heldRef) : null;
    // Membership writes wait until every read in this transaction is done (Firestore needs reads before writes).
    let chargeMembership: { ref: FirebaseFirestore.DocumentReference; used: number } | null = null;
    if (memberRows) {
      const pick = membershipForFreePickup(memberRows.docs.map((d) => d.data() as Membership), now);
      if (pick) {
        memberMembershipId = pick.id;
        chargeMembership = { ref: db.collection(COLLECTIONS.memberships()).doc(pick.id), used: (pick.pickupsUsed ?? 0) + 1 };
      }
    }
    if (heldRef && heldSnap?.exists) {
      const hm = heldSnap.data() as Membership;
      chargeMembership = { ref: heldRef, used: Math.max(0, (hm.pickupsUsed ?? 0) - 1) };
      memberMembershipId = null;
    }
    const fees = wantFee && !memberMembershipId ? legFees(cur.kind, curFeePaise) : { pickup: 0, drop: 0 };
    if ((fees.pickup + fees.drop > 0 || feeBilled) && cur.bookingId && (wantFee || data.status === "DECLINED")) {
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", cur.bookingId).limit(1));
      const jobDoc = jobs.docs[0];
      if (jobDoc) {
        const job = jobDoc.data() as ServiceJob;
        const bRef = db.collection(COLLECTIONS.bookings()).doc(cur.bookingId);
        const [inv, pay, bSnap] = await Promise.all([
          tx.get(db.collection(COLLECTIONS.invoices()).where("jobId", "==", job.id).where("tenantId", "==", job.tenantId)),
          tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).where("status", "in", ["pending", "processing", "completed"]).limit(1)),
          tx.get(bRef),
        ]);
        const invoiced = inv.docs.some((d) => (d.data() as Invoice).status !== "void");
        const locked = invoiced || !pay.empty || job.paymentStatus === "paid" || job.status === "CANCELLED" || job.status === "DELIVERED";
        const want = wantFee ? fees : { pickup: 0, drop: 0 };
        if (!locked) {
          const next = applyPickupFees(job.priceBreakdown, want.pickup, want.drop);
          const delta = next.total - job.priceBreakdown.total;
          if (delta !== 0 || next.pickupFee !== job.priceBreakdown.pickupFee || next.dropFee !== job.priceBreakdown.dropFee) {
            tx.update(jobDoc.ref, { priceBreakdown: next, totalAmount: job.totalAmount + delta, updatedAt: now });
            if (bSnap.exists) {
              const b = bSnap.data() as Booking;
              tx.update(bRef, { priceBreakdown: applyPickupFees(b.priceBreakdown, want.pickup, want.drop), totalAmount: b.totalAmount + delta, updatedAt: now });
            }
          }
          feeBilled = want.pickup + want.drop > 0;
        } else if (wantFee && fees.pickup + fees.drop > 0) {
          feeBilled = false;
        }
      }
    }
    const feeUnbilled = wantFee && (fees.pickup + fees.drop > 0) && !feeBilled;

    if (chargeMembership) tx.update(chargeMembership.ref, { pickupsUsed: chargeMembership.used, updatedAt: now });
    tx.update(ref, { status: data.status, staffNote, agreedPickupAt, agreedDropAt, feeBilled, memberMembershipId, pickupCompletedAt, dropCompletedAt, ...(data.feePaise !== undefined ? { feePaise: data.feePaise } : {}), updatedAt: now });
    writeAuditLog(tx, {
      action: "pickup.updated",
      entityType: "PickupRequest",
      entityId: ref.id,
      user,
      studioId: cur.studioId,
      before: { status: cur.status },
      after: { status: data.status, agreedPickupAt, agreedDropAt, ...(legChanged ? { legCompleted: data.markLegCompleted } : {}) },
    });
    return { requestId: data.requestId, status: data.status, idempotent: false, feeBilled, feeUnbilled, pickupCompletedAt, dropCompletedAt };
  });
  return result;
});

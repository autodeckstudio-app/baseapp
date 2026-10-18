// Admin-only cancel for a booking, with the fee and any refund decided here on the server.
// Cancel and refund are admin-only for now (owner decision); studio staff have no cancel.
//  - adminCancelBooking: preview=true returns the numbers and writes nothing. Otherwise it cancels in one go:
//    fee (policy fee or waived) is taken out of what was paid, the rest goes back through the payment provider,
//    credits come back (wash, member pickup, gift), the pickup request closes, the invoice is voided.
//    If the provider refuses, the booking is NOT cancelled and the claim is released.
//  - settleCancellationFee: marks a fee that is still due as collected or waived.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import type { Booking, ServiceJob, Payment, Invoice } from "@autodeck/core";
import { cancellationTerms } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { planRefund, readCancelReads, writeCancelRestores } from "../../lib/cancel-booking.js";

const adminCancelSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
  /** charge = the customer asked late, the policy fee applies. waive = studio cancelled or goodwill. */
  feeAction: z.enum(["charge", "waive"]),
  preview: z.boolean().optional(),
}).strict();

const settleFeeSchema = z.object({
  bookingId: z.string().min(1),
  action: z.enum(["collected", "waived"]),
  note: z.string().trim().max(300).optional(),
}).strict();

const CANCELLABLE_JOB = ["PENDING_VEHICLE", "STANDBY", "VEHICLE_RECEIVED"];

export const SAME_DAY_MESSAGE = "Bookings can be cancelled until the day before. For a same-day change, please call the studio.";

/** Customers cancel only bookings that start on a later day (studio timezone is India). */
export function isCancellableDay(scheduledDate: string, nowMs: number): boolean {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(nowMs));
  return scheduledDate > today;
}

/** The one cancel path: fee, refund through the payment provider, credits back, slot released. Admin and customer share it. */
export async function runCancel(
  user: ReturnType<typeof extractUser>,
  data: { bookingId: string; reason: string; feeAction: "charge" | "waive"; preview?: boolean | undefined },
  actor: "admin" | "customer",
) {
    const db = getFirestore();
    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
    const snap = await bookingRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const booking = snap.data() as Booking;
    assertTenant(user, booking.tenantId);
    assertStudio(user, booking.studioId, "Booking");
    if (actor === "customer") {
      if (booking.customerId !== user.uid) throw new HttpsError("permission-denied", "Cannot cancel another customer's booking.");
      // Only a booking on a later day can be cancelled by the customer: a same-day cancel leaves the slot empty with no time to refill it.
      if (!isCancellableDay(booking.scheduledDate, Date.now())) throw new HttpsError("failed-precondition", SAME_DAY_MESSAGE);
    }
    if (booking.status === "CANCELLED") return { success: true, alreadyCancelled: true };
    if (booking.status === "COMPLETED" || booking.status === "EXPIRED") {
      throw new HttpsError("failed-precondition", `Cannot cancel a booking with status ${booking.status}.`);
    }

    const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1).get();
    const job = jobsSnap.docs[0]?.data() as ServiceJob | undefined;
    if (job && !CANCELLABLE_JOB.includes(job.status)) {
      throw new HttpsError("failed-precondition", "Work has already started on this job, so the booking cannot be cancelled here.");
    }
    const paySnap = job
      ? await db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).where("status", "in", ["pending", "processing", "completed"]).limit(10).get()
      : null;
    const payDocs = paySnap?.docs ?? [];
    if (payDocs.some((d) => d.data()["status"] === "processing")) {
      throw new HttpsError("failed-precondition", "A payment is still processing on this booking. Wait for it to settle, then cancel.");
    }
    const completed = payDocs.filter((d) => d.data()["status"] === "completed");
    if (completed.length > 1) {
      throw new HttpsError("failed-precondition", "This booking has more than one payment. Cancel it by hand and refund each payment from Payments.");
    }
    const payment = completed[0]?.data() as Payment | undefined;

    let categories = booking.cancelCategories ?? [];
    if (!categories.length) {
      const svc = await db.collection(COLLECTIONS.services()).doc(booking.serviceId).get();
      categories = svc.exists ? [String((svc.data() as { category?: string }).category ?? "")] : [];
    }
    const terms = cancellationTerms({ categories, totalPaise: booking.totalAmount, scheduledAtMs: Date.parse(booking.scheduledAt), nowMs: Date.now() });
    const plan = planRefund({ paidPaise: payment?.amount ?? 0, feePaise: terms.feePaise, waive: data.feeAction === "waive" });
    const summary = { paidPaise: plan.paidPaise, policyFeePaise: terms.feePaise, feePaise: plan.feePaise, feeStatus: plan.feeStatus, refundPaise: plan.refundPaise, method: payment?.method ?? null };
    if (data.preview) return { preview: true, ...summary };

    const now = new Date().toISOString();
    const paymentRef = completed[0]?.ref;
    const refundEventRef = payment && paymentRef ? db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${paymentRef.id}`) : null;
    const needsRefund = plan.refundPaise > 0 && !!payment && !!paymentRef;

    // 1. Claim the refund so it can only ever be sent once, and check nothing changed since the preview.
    let claimed = false;
    if (needsRefund && refundEventRef && paymentRef) {
      await db.runTransaction(async (tx) => {
        const [b, p, ev] = await Promise.all([tx.get(bookingRef), tx.get(paymentRef), tx.get(refundEventRef)]);
        if ((b.data() as Booking | undefined)?.status === "CANCELLED") throw new HttpsError("failed-precondition", "This booking was just cancelled.");
        if ((p.data() as Payment | undefined)?.status !== "completed") throw new HttpsError("failed-precondition", "The payment changed. Reload and try again.");
        if (ev.exists) throw new HttpsError("already-exists", "A refund has already been started for this payment.");
        tx.set(refundEventRef, { paymentId: paymentRef.id, claimedAt: now, claimedBy: user.uid, bookingId: data.bookingId, amount: plan.refundPaise });
      });
      claimed = true;
    }

    // 2. Provider refund (partial amount), once. A failure releases the claim and cancels nothing.
    let providerRefundId: string | null = null;
    try {
      if (claimed && payment && paymentRef && payment.method === "razorpay_payment_link" && payment.razorpayPaymentId) {
        const res = await getPaymentProvider().initiateRefund({
          providerPaymentId: payment.razorpayPaymentId,
          amount: plan.refundPaise,
          reason: data.reason,
          referenceId: `refund_${paymentRef.id}`,
        });
        providerRefundId = res.providerRefundId;
      }
    } catch {
      if (refundEventRef) await refundEventRef.delete().catch(() => undefined);
      throw new HttpsError("unavailable", "The refund did not go through, so the booking is NOT cancelled. Try again, or refund from Payments.");
    }
    const manualRefund = claimed && !providerRefundId;

    // 3. Cancel everything in one transaction.
    await db.runTransaction(async (tx) => {
      const fresh = (await tx.get(bookingRef)).data() as Booking | undefined;
      if (!fresh) throw new HttpsError("not-found", "Booking not found.");
      if (fresh.status === "CANCELLED") throw new HttpsError("failed-precondition", "This booking was just cancelled.");
      const jobs = await tx.get(db.collection(COLLECTIONS.jobs()).where("bookingId", "==", data.bookingId).limit(1));
      const jobDoc = jobs.docs[0];
      const j = jobDoc?.data() as ServiceJob | undefined;
      if (j && !CANCELLABLE_JOB.includes(j.status)) throw new HttpsError("failed-precondition", "Work has already started on this job.");
      const pays = j ? await tx.get(db.collection(COLLECTIONS.payments()).where("jobId", "==", j.id).where("status", "in", ["pending", "completed"]).limit(10)) : null;
      const invoiceSnap = needsRefund && payment?.invoiceId ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId)) : null;
      const reads = await readCancelReads(tx, db, fresh, data.bookingId);

      for (const d of pays?.docs ?? []) {
        if (d.data()["status"] === "pending") tx.update(d.ref, { status: "cancelled", updatedAt: now });
      }
      writeCancelRestores(tx, reads, fresh, data.bookingId, user, now, `Booking cancelled by ${actor}: ${data.bookingId}`);

      if (needsRefund && paymentRef && payment) {
        tx.update(paymentRef, { status: "refunded", razorpayRefundId: providerRefundId, refundAmount: plan.refundPaise, refundedAt: now, updatedAt: now });
        if (invoiceSnap?.exists && (invoiceSnap.data() as Invoice).status !== "void" && payment.invoiceId) {
          tx.update(invoiceSnap.ref, { status: "void", voidedAt: now, voidedReason: `Booking cancelled: ${data.reason}`, updatedAt: now });
        }
      }
      if (jobDoc && j) {
        tx.update(jobDoc.ref, {
          status: "CANCELLED",
          ...(needsRefund ? { paymentStatus: "refunded" } : {}),
          statusHistory: [...j.statusHistory, { status: "CANCELLED", changedAt: now, changedBy: user.uid, notes: `Booking cancelled by admin: ${data.reason}` }],
          updatedAt: now,
        });
      }
      tx.update(bookingRef, {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: actor,
        cancellationReason: data.reason,
        cancellationFeePaise: plan.feePaise,
        ...(plan.feeStatus !== "none" ? { cancellationFeeStatus: plan.feeStatus } : {}),
        ...(plan.feeStatus === "waived" ? { cancellationFeeSettledBy: user.uid, cancellationFeeSettledAt: now } : {}),
        refundedPaise: plan.refundPaise,
        ...(needsRefund ? { paymentStatus: "refunded", refundStatus: "initiated", refundId: providerRefundId } : {}),
        updatedAt: now,
      });
      writeAuditLog(tx, {
        action: "booking.cancelled",
        entityType: "Booking",
        entityId: data.bookingId,
        user,
        studioId: booking.studioId,
        before: { status: fresh.status },
        after: { status: "CANCELLED", cancellationReason: data.reason, cancellationFeePaise: plan.feePaise, refundedPaise: plan.refundPaise, feeStatus: plan.feeStatus },
        metadata: { cancelledBy: actor, providerRefundId },
      });
    });

    return { success: true, ...summary, providerRefundId, manualRefund };
}

export const adminCancelBooking = onCall(
  { region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "admin", "superadmin");
    assertTenant(user, user.claims.tenantId);
    const data = validate(adminCancelSchema, request.data);
    if (!data.preview) await enforceRateLimit(subjectFrom(user), "booking.adminCancel");
    return runCancel(user, data, "admin");
  },
);

export const settleCancellationFee = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  assertTenant(user, user.claims.tenantId);
  const data = validate(settleFeeSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "booking.settleFee");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.bookings()).doc(data.bookingId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Booking not found.");
    const b = snap.data() as Booking;
    assertTenant(user, b.tenantId);
    assertStudio(user, b.studioId, "Booking");
    if (b.status !== "CANCELLED") throw new HttpsError("failed-precondition", "Only a cancelled booking has a cancellation fee.");
    if (!(b.cancellationFeePaise && b.cancellationFeePaise > 0)) throw new HttpsError("failed-precondition", "This booking has no cancellation fee.");
    if (b.cancellationFeeStatus !== "due") throw new HttpsError("failed-precondition", "This fee is already settled.");
    const now = new Date().toISOString();
    tx.update(ref, {
      cancellationFeeStatus: data.action,
      cancellationFeeSettledBy: user.uid,
      cancellationFeeSettledAt: now,
      ...(data.note ? { cancellationFeeNote: data.note } : {}),
      updatedAt: now,
    });
    writeAuditLog(tx, { action: "booking.cancel_fee_settled", entityType: "Booking", entityId: data.bookingId, user, studioId: b.studioId, before: { cancellationFeeStatus: "due" }, after: { cancellationFeeStatus: data.action, cancellationFeePaise: b.cancellationFeePaise } });
  });
  return { success: true };
});

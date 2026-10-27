// Admin-only: record that the office PHYSICALLY returned a manual (cash /
// direct UPI / bank) cancel refund to the customer. This moves no money and
// calls no provider - it closes the obligation runCancel recorded at cancel
// time (booking.manualRefundDuePaise + the unmarked refund_<paymentId>
// "manual refund obligation" claim) and only THEN marks the payment refunded.
// The ordering is the whole point of the manual-refund contract: the books
// say "returned" only after a human says the money actually left the till.
// Provider (razorpay_payment_link) refunds never settle by hand - they are
// submitted and projected by the refund outbox, and are refused here.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { settleManualRefundSchema } from "../../schemas/payment.js";

export const settleManualRefund = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);

  // Money-truth records are the office's, never the desk's.
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to settle a refund.");
  }

  const data = validate(settleManualRefundSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.refund");

  const db = getFirestore();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc(data.paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");
  const payment = paymentSnap.data() as Payment;
  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(paymentRef);
    if (!freshSnap.exists) throw new HttpsError("not-found", "Payment not found.");
    const fresh = freshSnap.data() as Payment;
    if (fresh.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    }
    if (fresh.method === "razorpay_payment_link") {
      throw new HttpsError("failed-precondition", "Online payments are refunded through the refund outbox, never settled by hand.");
    }
    if (fresh.status === "refunded") {
      throw new HttpsError("failed-precondition", "This payment is already marked refunded.");
    }
    if (fresh.status !== "completed" || (fresh.refundAmount ?? 0) !== 0) {
      throw new HttpsError("failed-precondition", `Cannot settle a payment in status '${fresh.status}'.`);
    }
    if (!fresh.bookingId) {
      throw new HttpsError("failed-precondition", "This payment has no booking obligation to settle. Refunds without a cancel obligation are handled from the payment, not here.");
    }

    const bookingRef = db.collection(COLLECTIONS.bookings()).doc(fresh.bookingId);
    const claimRef = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${fresh.id}`);
    const jobRef = fresh.jobId ? db.collection(COLLECTIONS.jobs()).doc(fresh.jobId) : null;
    const [bookingSnap, claimSnap, jobSnap] = await Promise.all([
      tx.get(bookingRef),
      tx.get(claimRef),
      ...(jobRef ? [tx.get(jobRef)] : []),
    ] as const);

    if (!bookingSnap.exists) throw new HttpsError("unavailable", "Linked booking missing; held for reconciliation with zero financial writes.");
    const booking = bookingSnap.data() as Booking;
    if (booking.tenantId !== user.claims.tenantId || booking.tenantId !== fresh.tenantId) {
      throw new HttpsError("unavailable", "Linked booking failed tenant verification; held with zero financial writes.");
    }
    if (booking.status !== "CANCELLED") {
      throw new HttpsError("failed-precondition", "The booking is not cancelled, so there is no cancel refund to settle.");
    }
    const due = booking.manualRefundDuePaise;
    if (typeof due !== "number" || !Number.isSafeInteger(due) || due <= 0) {
      throw new HttpsError("failed-precondition", "This booking has no open manual refund obligation.");
    }
    // The obligation marker must be the exact one runCancel wrote: kind-bound,
    // same payment, same booking, same amount. Anything else is refund
    // residue from another path - fail closed, inspect by hand.
    if (!claimSnap.exists) {
      throw new HttpsError("failed-precondition", "The manual refund obligation marker is missing; held for reconciliation.");
    }
    const claim = claimSnap.data() as { kind?: string; paymentId?: string; bookingId?: string; amount?: number; settledAt?: string };
    if (claim.kind !== "manual_refund_owed" || claim.paymentId !== fresh.id || claim.bookingId !== booking.id || claim.amount !== due || claim.settledAt) {
      throw new HttpsError("unavailable", "The manual refund obligation marker does not match this booking's obligation; held with zero financial writes.");
    }
    if (jobRef) {
      if (!jobSnap?.exists) throw new HttpsError("unavailable", "Linked job missing; held for reconciliation with zero financial writes.");
      const job = jobSnap.data() as { tenantId?: string; bookingId?: string | null };
      if (job.tenantId !== fresh.tenantId || job.bookingId !== booking.id) {
        throw new HttpsError("unavailable", "Linked job failed tenant/linkage verification; held with zero financial writes.");
      }
    }

    tx.update(paymentRef, { status: "refunded", razorpayRefundId: null, refundAmount: due, refundedAt: now, updatedAt: now });
    tx.update(bookingRef, { manualRefundDuePaise: null, refundedPaise: due, updatedAt: now });
    tx.set(claimRef, { settledAt: now, settledBy: user.uid, settleNote: data.note }, { merge: true });
    if (jobRef) tx.update(jobRef, { paymentStatus: "refunded", updatedAt: now });
    writeAuditLog(tx, {
      action: "payment.refunded",
      entityType: "Payment",
      entityId: fresh.id,
      user,
      studioId: fresh.studioId,
      before: { status: "completed", manualRefundDuePaise: due },
      after: { status: "refunded", refundAmount: due, note: data.note },
    });
    return { success: true, paymentId: fresh.id, refundedPaise: due };
  });
});

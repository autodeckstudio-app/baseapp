import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { initiatePaymentSchema } from "../../schemas/payment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";

// Keyed by jobId — the payable operational job — so the same flow works for a
// booking-sourced job or a walk-in job. bookingId (nullable) is carried onto
// the Payment record purely as a cross-reference, never as the lookup key.
export const initiatePayment = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(initiatePaymentSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.initiate");

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();

  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");

  const job = jobSnap.data() as ServiceJob;

  // Ownership: customer pays own job; studio/admin can initiate payment for any job
  const isOwner = job.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new HttpsError("permission-denied", "Cannot initiate payment for this job.");
  }
  if (job.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (job.status === "CANCELLED") {
    throw new HttpsError("failed-precondition", "Cannot pay for a cancelled job.");
  }

  // Fast-fail pre-check (cheap, avoids the provider call and a transaction
  // for an obviously-duplicate request) — NOT the authoritative check, since
  // it's mutable/racy across concurrent calls. See the re-check inside the
  // transaction below (Phase 5B P1-7 fix — this was previously a plain
  // pre-transaction query only, so two concurrent initiatePayment calls for
  // the same job could both pass it and each create a separate Payment).
  const preCheckPayments = await db
    .collection(COLLECTIONS.payments())
    .where("jobId", "==", data.jobId)
    .where("status", "in", ["pending", "processing", "completed"])
    .limit(1)
    .get();

  if (!preCheckPayments.empty) {
    const existing = preCheckPayments.docs[0]?.data() as Payment;
    if (existing?.status === "completed") {
      throw new HttpsError("already-exists", "This job has already been paid.");
    }
    return { paymentId: existing.id, paymentUrl: null, status: existing.status };
  }

  const now = new Date().toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();

  // Amount ALWAYS comes from job.totalAmount (immutable price snapshot) — NEVER from client
  const amount = job.totalAmount;

  // Authoritative re-check + claim, atomically: re-verify no in-flight/
  // completed payment exists for this job, and create THIS payment doc (as
  // "pending", provider fields still null) in the same transaction. Once
  // committed, the payment doc's own existence is the exclusivity claim — a
  // concurrent caller's own tx.get() query will see it and return the
  // existing payment instead of creating a duplicate.
  const claim = await db.runTransaction(async (tx) => {
    const freshExisting = await tx.get(
      db
        .collection(COLLECTIONS.payments())
        .where("jobId", "==", data.jobId)
        .where("status", "in", ["pending", "processing", "completed"])
        .limit(1),
    );
    if (!freshExisting.empty) {
      return { created: false as const, existing: freshExisting.docs[0]?.data() as Payment };
    }

    const payment: Payment = {
      id: paymentRef.id,
      tenantId: job.tenantId,
      studioId: job.studioId,
      targetType: "job",
      jobId: job.id,
      bookingId: job.bookingId,
      membershipId: null,
      customerId: job.customerId,
      amount,
      currency: job.priceBreakdown.currency,
      method: data.method,
      status: "pending",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: null,
      recordedBy: null,
      invoiceId: null,
      providerEventId: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(paymentRef, payment);
    writeAuditLog(tx, {
      action: "payment.initiated",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: job.studioId,
      after: { jobId: job.id, bookingId: job.bookingId, amount, method: data.method, status: "pending" },
    });
    return { created: true as const, existing: null };
  });

  if (!claim.created) {
    const existing = claim.existing as Payment;
    if (existing.status === "completed") {
      throw new HttpsError("already-exists", "This job has already been paid.");
    }
    return { paymentId: existing.id, paymentUrl: null, status: existing.status };
  }

  // Call the provider exactly once, now that this call has exclusive claim
  // on this job's payment slot, then patch the committed doc with the
  // resulting link.
  let paymentUrl: string | null = null;
  if (data.method === "razorpay_payment_link") {
    try {
      const provider = getPaymentProvider();
      const result = await provider.createPaymentLink({
        amount,
        currency: job.priceBreakdown.currency,
        bookingId: job.bookingId ?? job.id,
        description: `AutoDeck Job ${job.id}`,
        customerName: user.email ?? user.phone ?? "Customer",
        customerPhone: user.phone ?? "",
        referenceId: paymentRef.id,
      });
      paymentUrl = result.paymentUrl;
      await paymentRef.update({
        razorpayPaymentLinkId: result.providerPaymentLinkId,
        razorpayOrderId: result.providerOrderId,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Provider failed after the claim was already committed — mark this
      // payment failed so it doesn't permanently occupy the job's payment
      // slot for a link that was never actually issued; a genuine retry can
      // then claim a fresh payment.
      await paymentRef
        .update({ status: "failed", failedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .catch(() => undefined);
      throw err;
    }
  }

  return { paymentId: paymentRef.id, paymentUrl, status: "pending" };
});

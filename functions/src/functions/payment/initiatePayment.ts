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

  // Check for existing non-failed/cancelled payment for this job (prevent duplicates)
  const existingPayments = await db
    .collection(COLLECTIONS.payments())
    .where("jobId", "==", data.jobId)
    .where("status", "in", ["pending", "processing", "completed"])
    .limit(1)
    .get();

  if (!existingPayments.empty) {
    const existing = existingPayments.docs[0]?.data() as Payment;
    if (existing?.status === "completed") {
      throw new HttpsError("already-exists", "This job has already been paid.");
    }
    // Return existing pending payment rather than creating a duplicate
    return { paymentId: existing.id, paymentUrl: null, status: existing.status };
  }

  const now = new Date().toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();

  // Amount ALWAYS comes from job.totalAmount (immutable price snapshot) — NEVER from client
  const amount = job.totalAmount;

  let paymentUrl: string | null = null;
  let razorpayPaymentLinkId: string | null = null;
  let razorpayOrderId: string | null = null;

  if (data.method === "razorpay_payment_link") {
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
    razorpayPaymentLinkId = result.providerPaymentLinkId;
    razorpayOrderId = result.providerOrderId;
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
    razorpayPaymentLinkId,
    razorpayPaymentId: null,
    razorpayOrderId,
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

  await db.runTransaction(async (tx) => {
    tx.set(paymentRef, payment);
    writeAuditLog(tx, {
      action: "payment.initiated",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: job.studioId,
      after: { jobId: job.id, bookingId: job.bookingId, amount, method: data.method, status: "pending" },
    });
  });

  return { paymentId: paymentRef.id, paymentUrl, status: "pending" };
});

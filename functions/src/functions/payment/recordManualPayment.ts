// Studio/admin records a manual cash or direct UPI payment.
// Payment is immediately COMPLETED (no provider roundtrip needed for cash/UPI).
// Amount ALWAYS comes from job.totalAmount — client cannot set it.
//
// Keyed by jobId so the same function pays a booking-sourced job or a
// walk-in job identically — bookingId (nullable) is carried onto the
// Payment/Invoice as a cross-reference only.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { ServiceJob, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { recordManualPaymentSchema } from "../../schemas/payment.js";
import { allocateInvoiceNumber } from "../../lib/invoice-counter.js";
import { buildInvoice } from "../../lib/invoice-builder.js";

export const recordManualPayment = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(recordManualPaymentSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.recordManual");

  const db = getFirestore();
  const jobRef = db.collection(COLLECTIONS.jobs()).doc(data.jobId);

  // Fast-fail pre-check (cheap, avoids starting a transaction for an
  // obviously-invalid request) — NOT the authoritative check, since
  // paymentStatus is mutable and racy across concurrent calls. See the
  // re-check inside the transaction below.
  const preCheckSnap = await jobRef.get();
  if (!preCheckSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const preCheckJob = preCheckSnap.data() as ServiceJob;
  if (preCheckJob.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }

  const now = new Date().toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();
  const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();

  const result = await db.runTransaction(async (tx) => {
    // Authoritative re-read inside the transaction — two concurrent calls
    // for the same job (e.g. two staff members both tapping "Record
    // payment") must not both pass the paymentStatus check and each create
    // a separate Payment + Invoice for the same job.
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = jobSnap.data() as ServiceJob;

    if (job.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    }
    if (job.paymentStatus === "paid") {
      throw new HttpsError("already-exists", "This job has already been marked as paid.");
    }
    if (job.status === "CANCELLED") {
      throw new HttpsError("failed-precondition", "Cannot record payment for a cancelled job.");
    }

    // Amount ALWAYS from the job's server-computed snapshot — NEVER from client
    const amount = job.totalAmount;

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
      status: "completed",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: data.manualReference ?? null,
      recordedBy: user.uid,
      invoiceId: invoiceRef.id,
      providerEventId: null,
      completedAt: now,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const invoiceNumber = await allocateInvoiceNumber(tx, db, job.tenantId);
    const invoice = buildInvoice({
      invoiceId: invoiceRef.id,
      invoiceNumber,
      tenantId: job.tenantId,
      studioId: job.studioId,
      jobId: job.id,
      bookingId: job.bookingId,
      customerId: job.customerId,
      vehicleId: job.vehicleId,
      priceBreakdown: job.priceBreakdown,
      paymentId: paymentRef.id,
      serviceName: `Service ${job.serviceId}`,
    });

    tx.set(paymentRef, payment);
    tx.set(invoiceRef, invoice);
    tx.update(jobRef, {
      paymentStatus: "paid",
      updatedAt: now,
    });
    if (job.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
        paymentStatus: "paid",
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: "payment.completed",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: job.studioId,
      after: { method: data.method, amount, status: "completed", invoiceId: invoiceRef.id },
    });
    writeAuditLog(tx, {
      action: "invoice.issued",
      entityType: "Invoice",
      entityId: invoiceRef.id,
      user,
      studioId: job.studioId,
      after: { invoiceNumber, total: invoice.total, status: "issued" },
    });

    return { paymentId: paymentRef.id, invoiceId: invoiceRef.id };
  });

  return result;
});

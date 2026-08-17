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
import { recordManualPaymentSchema } from "../../schemas/payment.js";
import { allocateInvoiceNumber } from "../../lib/invoice-counter.js";
import { buildInvoice } from "../../lib/invoice-builder.js";

export const recordManualPayment = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(recordManualPaymentSchema, request.data);

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
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

  const now = new Date().toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();
  const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();

  // Amount ALWAYS from the job's server-computed snapshot — NEVER from client
  const amount = job.totalAmount;

  const payment: Payment = {
    id: paymentRef.id,
    tenantId: job.tenantId,
    studioId: job.studioId,
    jobId: job.id,
    bookingId: job.bookingId,
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

  await db.runTransaction(async (tx) => {
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
    tx.update(db.collection(COLLECTIONS.jobs()).doc(job.id), {
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
  });

  return { paymentId: paymentRef.id, invoiceId: invoiceRef.id };
});

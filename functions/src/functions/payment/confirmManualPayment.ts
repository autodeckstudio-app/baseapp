// Studio/admin confirms an EXISTING pending cash/manual payment — the
// production counterpart to recordManualPayment (which creates a new
// completed payment from scratch). This closes the gap left when a customer
// initiates a "Pay at studio" payment via initiatePayment: that payment sits
// 'pending' until a real member of staff confirms cash was actually received.
// Online (razorpay_payment_link) payments are explicitly out of scope here —
// those complete only via the (deferred) Razorpay webhook, never manually.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { confirmManualPaymentSchema } from "../../schemas/payment.js";
import { allocateInvoiceNumber } from "../../lib/invoice-counter.js";
import { buildInvoice } from "../../lib/invoice-builder.js";

export const confirmManualPayment = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(confirmManualPaymentSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.confirmManual");

  const db = getFirestore();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");

  const payment = paymentSnap.data() as Payment;

  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (user.claims.role === "studio" && user.claims.studioId !== payment.studioId) {
    throw new HttpsError("permission-denied", "Payment belongs to a different studio.");
  }
  if (payment.method === "razorpay_payment_link") {
    throw new HttpsError(
      "failed-precondition",
      "Online payments cannot be confirmed manually — they complete via the payment provider.",
    );
  }

  // Idempotent: a payment already confirmed (by this or a concurrent call)
  // returns its existing completed state rather than erroring.
  if (payment.status === "completed") {
    return { paymentId: payment.id, invoiceId: payment.invoiceId, alreadyCompleted: true };
  }
  if (payment.status !== "pending" && payment.status !== "processing") {
    throw new HttpsError(
      "failed-precondition",
      `Cannot confirm a payment in status '${payment.status}'.`,
    );
  }
  if (!payment.jobId) {
    throw new HttpsError("failed-precondition", "Payment has no linked job.");
  }

  const result = await db.runTransaction(async (tx) => {
    // All reads before any writes.
    const jobRef = db.collection(COLLECTIONS.jobs()).doc(payment.jobId as string);
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
    const job = jobSnap.data() as ServiceJob;

    // Re-check status inside the transaction — a concurrent confirmation
    // (e.g. two staff tapping "Confirm" at once) must not double-complete.
    const freshPaymentSnap = await tx.get(db.collection(COLLECTIONS.payments()).doc(payment.id));
    const freshPayment = freshPaymentSnap.data() as Payment;
    if (freshPayment.status === "completed") {
      return { paymentId: payment.id, invoiceId: freshPayment.invoiceId, alreadyCompleted: true };
    }
    if (freshPayment.status !== "pending" && freshPayment.status !== "processing") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot confirm a payment in status '${freshPayment.status}'.`,
      );
    }
    // Guard against the job having moved out from under this payment since
    // it was initiated — e.g. a different payment on the same job already
    // completed (recordManualPayment now blocks creating a second in-flight
    // payment, but this is defense-in-depth against that invariant ever
    // being violated), or the job/booking was cancelled while this payment
    // sat pending (Phase 6 hostile-audit finding — this check was previously
    // entirely absent here).
    if (job.paymentStatus === "paid") {
      throw new HttpsError("already-exists", "This job has already been marked as paid.");
    }
    if (job.status === "CANCELLED") {
      throw new HttpsError("failed-precondition", "Cannot confirm payment for a cancelled job.");
    }

    const now = new Date().toISOString();
    const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();
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
      paymentId: payment.id,
      serviceName: `Service ${job.serviceId}`,
    });

    tx.update(db.collection(COLLECTIONS.payments()).doc(payment.id), {
      status: "completed",
      invoiceId: invoiceRef.id,
      completedAt: now,
      updatedAt: now,
    });
    tx.set(invoiceRef, invoice);
    tx.update(jobRef, { paymentStatus: "paid", updatedAt: now });
    if (job.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(job.bookingId), {
        paymentStatus: "paid",
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: "payment.completed",
      entityType: "Payment",
      entityId: payment.id,
      user,
      studioId: job.studioId,
      after: { method: payment.method, amount: payment.amount, status: "completed", invoiceId: invoiceRef.id },
    });
    writeAuditLog(tx, {
      action: "invoice.issued",
      entityType: "Invoice",
      entityId: invoiceRef.id,
      user,
      studioId: job.studioId,
      after: { invoiceNumber, total: invoice.total, status: "issued" },
    });

    return { paymentId: payment.id, invoiceId: invoiceRef.id, alreadyCompleted: false };
  });

  return result;
});

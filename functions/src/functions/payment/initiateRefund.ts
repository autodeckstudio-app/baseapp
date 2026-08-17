// Admin-only: initiates a refund on a completed payment.
// Creates a new refund Payment record — does NOT mutate the original payment.
// In dev/emulator: mock provider is used. No live Razorpay refund API called.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { initiateRefundSchema } from "../../schemas/payment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";

export const initiateRefund = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to initiate refunds.");
  }

  const data = validate(initiateRefundSchema, request.data);

  const db = getFirestore();
  const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!paymentSnap.exists) throw new HttpsError("not-found", "Payment not found.");

  const payment = paymentSnap.data() as Payment;

  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (payment.status !== "completed") {
    throw new HttpsError(
      "failed-precondition",
      "Can only refund completed payments.",
    );
  }

  const now = new Date().toISOString();

  // Call provider refund (mock in dev, real Razorpay in production)
  let providerRefundId: string | null = null;
  if (payment.method === "razorpay_payment_link" && payment.razorpayPaymentId) {
    const provider = getPaymentProvider();
    const result = await provider.initiateRefund({
      providerPaymentId: payment.razorpayPaymentId,
      amount: payment.amount,
      reason: data.reason,
      referenceId: `refund_${data.paymentId}_${Date.now()}`,
    });
    providerRefundId = result.providerRefundId;
  }

  await db.runTransaction(async (tx) => {
    // All reads must happen before any writes within a Firestore transaction.
    const invoiceSnap = payment.invoiceId
      ? await tx.get(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId))
      : null;

    // Mark original payment as refunded
    tx.update(db.collection(COLLECTIONS.payments()).doc(data.paymentId), {
      status: "refunded",
      razorpayRefundId: providerRefundId,
      refundAmount: payment.amount,
      refundedAt: now,
      updatedAt: now,
    });

    // Void the linked invoice (if any)
    if (payment.invoiceId && invoiceSnap) {
      if (invoiceSnap.exists) {
        const invoice = invoiceSnap.data() as Invoice;
        if (invoice.status !== "void") {
          tx.update(db.collection(COLLECTIONS.invoices()).doc(payment.invoiceId), {
            status: "void",
            voidedAt: now,
            voidedReason: `Refund initiated: ${data.reason}`,
            updatedAt: now,
          });
          writeAuditLog(tx, {
            action: "invoice.voided",
            entityType: "Invoice",
            entityId: payment.invoiceId,
            user,
            studioId: payment.studioId,
            after: { status: "void", reason: data.reason },
          });
        }
      }
    }

    // Update job paymentStatus — the job is always present, booking-sourced or walk-in
    if (payment.jobId) {
      tx.update(db.collection(COLLECTIONS.jobs()).doc(payment.jobId), {
        paymentStatus: "refunded",
        updatedAt: now,
      });
    }

    // Sync linked booking, if any
    if (payment.bookingId) {
      tx.update(db.collection(COLLECTIONS.bookings()).doc(payment.bookingId), {
        paymentStatus: "refunded",
        updatedAt: now,
      });
    }

    writeAuditLog(tx, {
      action: "payment.refunded",
      entityType: "Payment",
      entityId: data.paymentId,
      user,
      studioId: payment.studioId,
      after: {
        status: "refunded",
        reason: data.reason,
        refundAmount: payment.amount,
        providerRefundId,
      },
    });
  });

  return { paymentId: data.paymentId, refunded: true, providerRefundId };
});

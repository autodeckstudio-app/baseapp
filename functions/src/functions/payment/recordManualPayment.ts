// Studio/admin records a manual cash or direct UPI payment.
// Payment is immediately COMPLETED (no provider roundtrip needed for cash/UPI).
// Amount ALWAYS comes from booking.totalAmount — client cannot set it.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Payment } from "@autodeck/core";
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
  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();
  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");

  const booking = bookingSnap.data() as Booking;

  if (booking.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (booking.paymentStatus === "paid") {
    throw new HttpsError("already-exists", "This booking has already been marked as paid.");
  }
  if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
    throw new HttpsError("failed-precondition", "Cannot record payment for a cancelled/expired booking.");
  }

  const now = new Date().toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();
  const invoiceRef = db.collection(COLLECTIONS.invoices()).doc();

  // Amount ALWAYS from booking snapshot — NEVER from client
  const amount = booking.totalAmount;

  const payment: Payment = {
    id: paymentRef.id,
    tenantId: booking.tenantId,
    studioId: booking.studioId,
    jobId: "",
    bookingId: booking.id,
    customerId: booking.customerId,
    amount,
    currency: booking.priceBreakdown.currency,
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
    const invoiceNumber = await allocateInvoiceNumber(tx, db, booking.tenantId);
    const invoice = buildInvoice({
      invoiceId: invoiceRef.id,
      invoiceNumber,
      booking,
      paymentId: paymentRef.id,
      studioId: booking.studioId,
      serviceName: `Service ${booking.serviceId}`,
    });

    tx.set(paymentRef, payment);
    tx.set(invoiceRef, invoice);
    tx.update(db.collection(COLLECTIONS.bookings()).doc(booking.id), {
      paymentStatus: "paid",
      updatedAt: now,
    });

    writeAuditLog(tx, {
      action: "payment.completed",
      entityType: "Payment",
      entityId: paymentRef.id,
      user,
      studioId: booking.studioId,
      after: { method: data.method, amount, status: "completed", invoiceId: invoiceRef.id },
    });
    writeAuditLog(tx, {
      action: "invoice.issued",
      entityType: "Invoice",
      entityId: invoiceRef.id,
      user,
      studioId: booking.studioId,
      after: { invoiceNumber, total: invoice.total, status: "issued" },
    });
  });

  return { paymentId: paymentRef.id, invoiceId: invoiceRef.id };
});

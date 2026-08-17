import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking, Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { initiatePaymentSchema } from "../../schemas/payment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";

export const initiatePayment = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  const data = validate(initiatePaymentSchema, request.data);

  const db = getFirestore();
  const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(data.bookingId).get();

  if (!bookingSnap.exists) throw new HttpsError("not-found", "Booking not found.");

  const booking = bookingSnap.data() as Booking;

  // Ownership: customer pays own booking; studio/admin can initiate payment for any booking
  const isOwner = booking.customerId === user.uid;
  const isStudioOrAdmin = ["studio", "admin", "superadmin"].includes(user.claims.role);
  if (!isOwner && !isStudioOrAdmin) {
    throw new HttpsError("permission-denied", "Cannot initiate payment for this booking.");
  }
  if (booking.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
    throw new HttpsError("failed-precondition", "Cannot pay for a cancelled or expired booking.");
  }

  // Check for existing non-failed/cancelled payment for this booking (prevent duplicates)
  const existingPayments = await db
    .collection(COLLECTIONS.payments())
    .where("bookingId", "==", data.bookingId)
    .where("status", "in", ["pending", "processing", "completed"])
    .limit(1)
    .get();

  if (!existingPayments.empty) {
    const existing = existingPayments.docs[0]?.data() as Payment;
    if (existing?.status === "completed") {
      throw new HttpsError("already-exists", "This booking has already been paid.");
    }
    // Return existing pending payment rather than creating a duplicate
    return { paymentId: existing.id, paymentUrl: null, status: existing.status };
  }

  const now = new Date().toISOString();
  const paymentRef = db.collection(COLLECTIONS.payments()).doc();

  // Amount ALWAYS comes from booking.totalAmount (immutable price snapshot) — NEVER from client
  const amount = booking.totalAmount;

  let paymentUrl: string | null = null;
  let razorpayPaymentLinkId: string | null = null;
  let razorpayOrderId: string | null = null;

  if (data.method === "razorpay_payment_link") {
    const provider = getPaymentProvider();
    const result = await provider.createPaymentLink({
      amount,
      currency: booking.priceBreakdown.currency,
      bookingId: booking.id,
      description: `AutoDeck Booking ${booking.id}`,
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
    tenantId: booking.tenantId,
    studioId: booking.studioId,
    jobId: "", // linked to job when job is sealed
    bookingId: booking.id,
    customerId: booking.customerId,
    amount,
    currency: booking.priceBreakdown.currency,
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
      studioId: booking.studioId,
      after: { bookingId: booking.id, amount, method: data.method, status: "pending" },
    });
  });

  return { paymentId: paymentRef.id, paymentUrl, status: "pending" };
});

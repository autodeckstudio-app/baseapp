// Admin-only: reserves a booking/job refund in the outbox. No provider call
// happens here — the reserved request is submitted and projected by the
// (emulator-gated) runner, so a booking refund can never fire twice and never
// silently: the amount and reason are explicit on the reservation.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { requestBookingRefundSchema } from "../../schemas/payment.js";
import { reserveRefund, refundablePaise } from "../../lib/refund-outbox.js";

export const requestBookingRefund = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to reserve refunds.");
  }
  const data = validate(requestBookingRefundSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.refund");

  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Payment not found.");
  const payment = snap.data() as Payment;
  if (payment.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (payment.method !== "razorpay_payment_link") {
    // Cash/UPI/bank refunds settle outside the provider; recording them is a
    // separate, still-held flow — do not improvise it here.
    throw new HttpsError("failed-precondition", "Only provider (Razorpay) payments can be refunded through the outbox.");
  }
  const amount = data.amountPaise ?? refundablePaise(payment);
  if (amount <= 0) throw new HttpsError("failed-precondition", "Nothing refundable left on this payment.");
  try {
    const { requestId } = await reserveRefund(db, {
      payment, amountPaise: amount, reason: data.reason, createdBy: user.uid,
    });
    return { requestId, amountPaise: amount, status: "reserved" };
  } catch (err) {
    throw new HttpsError("failed-precondition", err instanceof Error ? err.message : "Could not reserve refund.");
  }
});

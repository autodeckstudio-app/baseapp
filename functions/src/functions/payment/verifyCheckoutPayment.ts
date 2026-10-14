import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { verifyCheckoutPaymentSchema } from "../../schemas/payment.js";
import { signatureMatches } from "../../lib/razorpay-checkout.js";
import { completeVerifiedCheckout } from "../../lib/razorpay-verified-checkout.js";

// Step 3: check the signature the checkout modal returned. A match records the
// provider payment id and completes the payment through the same processor the
// webhook uses (invoice, membership). The signed order_id|payment_id pair is proof
// of payment, so activation does not depend on the webhook arriving. The webhook
// stays as a backup: it finds the payment already completed and changes nothing.
export const verifyCheckoutPayment = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_SECRET"] }, async (request) => {
  const user = extractUser(request);
  const data = validate(verifyCheckoutPaymentSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.verify");

  const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
  if (!keySecret) throw new HttpsError("failed-precondition", "Online payment is not set up yet.");

  const ref = getFirestore().collection(COLLECTIONS.payments()).doc(data.paymentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Payment not found.");
  const payment = snap.data() as Payment;
  if (payment.customerId !== user.uid || payment.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Cannot verify this payment.");
  if (!payment.razorpayOrderId || payment.razorpayOrderId !== data.razorpay_order_id) throw new HttpsError("failed-precondition", "Order does not match this payment.");
  if (!signatureMatches(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature, keySecret)) {
    throw new HttpsError("invalid-argument", "Payment could not be verified.");
  }
  const db = getFirestore();
  if (payment.status === "pending") {
    await ref.update({ status: "processing", razorpayPaymentId: data.razorpay_payment_id, updatedAt: new Date().toISOString() });
  }
  const outcome = await completeVerifiedCheckout(db, { paymentId: data.paymentId, orderId: data.razorpay_order_id, providerPaymentId: data.razorpay_payment_id });
  const after = (await ref.get()).data() as Payment;
  return { verified: true, status: after.status, outcome };
});

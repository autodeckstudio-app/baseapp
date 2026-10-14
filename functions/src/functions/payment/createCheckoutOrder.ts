import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createCheckoutOrderSchema } from "../../schemas/payment.js";
import { createRazorpayOrder } from "../../lib/razorpay-checkout.js";

// Step 1 of Standard Checkout: the customer opens checkout for their own pending payment.
export const createCheckoutOrder = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] }, async (request) => {
  const user = extractUser(request);
  const data = validate(createCheckoutOrderSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.createOrder");

  const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
  const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
  if (!keyId || !keySecret) throw new HttpsError("failed-precondition", "Online payment is not set up yet.");

  const ref = getFirestore().collection(COLLECTIONS.payments()).doc(data.paymentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Payment not found.");
  const payment = snap.data() as Payment;
  if (payment.customerId !== user.uid || payment.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Cannot pay for this.");
  if (payment.status !== "pending" && payment.status !== "processing") throw new HttpsError("failed-precondition", "This payment is already closed.");

  let order;
  try {
    order = await createRazorpayOrder({ amount: payment.amount, currency: payment.currency, receipt: payment.id, keyId, keySecret });
  } catch (err) {
    console.error("createCheckoutOrder failed", err instanceof Error ? err.message : err);
    throw new HttpsError("unavailable", "Could not start the payment. Please try again.");
  }
  await ref.update({ razorpayOrderId: order.id, updatedAt: new Date().toISOString() });
  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId };
});

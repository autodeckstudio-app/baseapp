import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createCheckoutOrderSchema } from "../../schemas/payment.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { nativeGiftPaymentEnabled } from "../../lib/gift-payment-gate.js";
import { obtainGiftPaymentLink } from "../../lib/gift-payment-link.js";

export const requestGiftPaymentLink = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], enforceAppCheck: shouldEnforceAppCheck() }, async request => {
  const user = extractUser(request);
  assertRole(user, "customer");
  if (!nativeGiftPaymentEnabled()) throw new HttpsError("failed-precondition", "Native gift payments are not enabled yet.");
  const data = validate(createCheckoutOrderSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.createOrder");
  const db = getFirestore();
  const p = (await db.collection(COLLECTIONS.payments()).doc(data.paymentId).get()).data() as Payment | undefined;
  if (!p || p.customerId !== user.uid || p.tenantId !== user.claims.tenantId || p.targetType !== "gift") throw new HttpsError("permission-denied", "Cannot pay for this gift.");
  try {
    const out = await obtainGiftPaymentLink(db, p, getPaymentProvider(), user.phone ?? "");
    return { paymentId: p.id, paymentUrl: out.outcome === "link_ready" ? out.paymentUrl : null, status: out.outcome };
  } catch (err) { throw new HttpsError("failed-precondition", err instanceof Error ? err.message : "Gift payment is not ready."); }
});

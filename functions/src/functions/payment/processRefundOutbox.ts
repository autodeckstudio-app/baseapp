// Admin-only, NON-PRODUCTION gate: runs the refund outbox against the payment
// provider (mock in dev/emulator). There is no scheduler and no production
// adapter: in the production project this callable refuses, because live
// Razorpay refund wiring stays held until the owner asks for deploy-time work
// (owner, 23 Oct: refunds wired "when we are ready to deploy").
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { isProductionProject } from "../../lib/environment.js";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { processRefundOutboxSchema } from "../../schemas/payment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { runRefundOutbox } from "../../lib/refund-outbox.js";

export const processRefundOutbox = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to run the refund outbox.");
  }
  if (isProductionProject()) {
    throw new HttpsError("failed-precondition", "Refund runner is not wired to the live provider; held for deploy-time review.");
  }
  const data = validate(processRefundOutboxSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.refund");
  const result = await runRefundOutbox(getFirestore(), getPaymentProvider(), { limit: data.limit ?? 10 });
  return result;
});

// Admin-only, NON-PRODUCTION gate: runs the refund outbox against the payment
// provider (mock in dev/emulator). There is no scheduler and no production
// wiring: in the production project this callable refuses, because live
// Razorpay refund wiring is held for an explicit deploy-time activation
// review. Nothing here runs in production until that review lifts the refusal.
import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
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
  const data = validate(processRefundOutboxSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "payment.refund");
  // D5: scoped to the caller's tenant - an admin may never process another
  // tenant's refund requests.
  const result = await runRefundOutbox(getFirestore(), getPaymentProvider(), { limit: data.limit ?? 10, tenantId: user.claims.tenantId, runnerId: `${user.uid}:${randomUUID()}` });
  return result;
});

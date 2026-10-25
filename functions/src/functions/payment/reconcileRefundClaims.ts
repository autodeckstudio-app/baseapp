// Admin-only RECONCILIATION-ONLY sweep of retained legacy refund claims.
// Verifies provider evidence bound to each claim's deterministic referenceId
// and projects truthful processed money, releases on authoritative absence,
// or holds with a visible note. It NEVER submits a new refund: the provider
// is used read-only (findRefundByReference). Production-gated like
// processRefundOutbox: projecting money-as-returned is a financial write and
// stays held for the deploy-time activation review.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { extractUser } from "../../middleware/auth.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { reconcileLegacyRefundClaims } from "../../lib/refund-claims.js";

export const reconcileRefundClaims = onCall({ region: "asia-south1", secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"], enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  if (!["admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Admin role required to reconcile refund claims.");
  }
  await enforceRateLimit(subjectFrom(user), "payment.refund");
  const result = await reconcileLegacyRefundClaims(getFirestore(), getPaymentProvider(), { tenantId: user.claims.tenantId, actor: user });
  return result;
});

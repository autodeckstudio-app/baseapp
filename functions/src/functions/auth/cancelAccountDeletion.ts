import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

/**
 * Customer cancels their own account deletion request, allowed for 7 days after it was made.
 * New and additive: it only flips the status on the customer's own request record.
 */
export const cancelAccountDeletion = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  await enforceRateLimit(subjectFrom(user), "account.deletion.cancel");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.accountDeletionRequests()).doc(user.uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "There is no deletion request to cancel.");
    const req = snap.data() as { status?: string; cancelUntil?: string; tenantId?: string };
    if (req.tenantId !== user.claims.tenantId) throw new HttpsError("permission-denied", "Not your request.");
    if (req.status !== "REQUESTED") throw new HttpsError("failed-precondition", "This request can no longer be cancelled.");
    if (req.cancelUntil && Date.now() > Date.parse(req.cancelUntil)) {
      throw new HttpsError("failed-precondition", "The 7 day window to cancel has passed.");
    }
    tx.update(ref, { status: "CANCELLED", cancelledAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "account.deletion_cancelled", entityType: "Customer", entityId: user.uid, user, studioId: null });
  });
  return { status: "CANCELLED" };
});

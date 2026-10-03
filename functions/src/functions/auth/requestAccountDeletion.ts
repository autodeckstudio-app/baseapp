import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";

/**
 * Customer asks to delete their account. This only RECORDS the request; nothing is erased here.
 * Erasure follows the retention rules the owner decides (invoices and warranties may need to be kept). New, additive.
 */
export const requestAccountDeletion = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  assertTenant(user, user.claims.tenantId);
  await enforceRateLimit(subjectFrom(user), "account.deletion");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.accountDeletionRequests()).doc(user.uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    tx.set(ref, { id: user.uid, tenantId: user.claims.tenantId, customerId: user.uid, status: "REQUESTED", createdAt: new Date().toISOString() });
    writeAuditLog(tx, { action: "account.deletion_requested", entityType: "Customer", entityId: user.uid, user, studioId: null });
  });
  return { status: "REQUESTED" };
});

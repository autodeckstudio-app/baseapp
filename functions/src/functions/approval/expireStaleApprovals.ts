// Admin-triggerable bulk expiry sweep — same pattern as
// expireStaleMemberships.ts. No onSchedule trigger exists in this codebase
// yet; this is exposed as a callable a real cron (or an operator) can
// invoke. Expiry is ALSO enforced lazily inside respondToApproval, so a
// customer can never act on a stale approval regardless of whether this
// sweep has run.
import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";

export const expireStaleApprovals = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const db = getFirestore();
  const now = new Date().toISOString();

  const snap = await db
    .collection(COLLECTIONS.approvals())
    .where("tenantId", "==", user.claims.tenantId)
    .where("status", "==", "pending")
    .where("expiresAt", "<", now)
    .get();

  if (snap.empty) return { expiredCount: 0 };

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "expired" });
  }
  await batch.commit();

  const auditBatch = db.batch();
  for (const doc of snap.docs) {
    const ref = db.collection(COLLECTIONS.auditLog()).doc();
    auditBatch.set(ref, {
      id: ref.id,
      tenantId: user.claims.tenantId,
      studioId: null,
      action: "approval.expired",
      entityType: "ApprovalRequest",
      entityId: doc.id,
      performedBy: user.uid,
      performedByRole: user.claims.role,
      before: { status: "pending" },
      after: { status: "expired" },
      metadata: {},
      createdAt: now,
    });
  }
  await auditBatch.commit();

  return { expiredCount: snap.docs.length };
});

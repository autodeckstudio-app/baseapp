// Admin-triggerable bulk expiry sweep. Flips any 'active' membership whose
// endDate has passed to 'expired'. This is the enforcement mechanism behind
// the (not-yet-deployed) daily cron described in doc16 §16.3 — no onSchedule
// trigger exists in this codebase yet, so this is exposed as a callable that
// a real cron (or an operator) can invoke. Expiry is ALSO enforced lazily at
// booking time (createBooking rejects an active-but-past-endDate membership
// regardless of whether this sweep has run yet).
import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";

export const expireStaleMemberships = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10);

  const snap = await db
    .collection(COLLECTIONS.memberships())
    .where("tenantId", "==", user.claims.tenantId)
    .where("status", "==", "active")
    .where("endDate", "<", today)
    .get();

  if (snap.empty) return { expiredCount: 0 };

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, { status: "expired", updatedAt: now });
  }
  await batch.commit();

  // One audit entry per membership — bulk sweep, but each is an individually
  // auditable state change.
  const auditBatch = db.batch();
  for (const doc of snap.docs) {
    const membership = doc.data() as Membership;
    const ref = db.collection(COLLECTIONS.auditLog()).doc();
    auditBatch.set(ref, {
      id: ref.id,
      tenantId: user.claims.tenantId,
      studioId: null,
      action: "membership.expired",
      entityType: "Membership",
      entityId: doc.id,
      performedBy: user.uid,
      performedByRole: user.claims.role,
      before: { status: "active", endDate: membership.endDate },
      after: { status: "expired" },
      metadata: {},
      createdAt: now,
    });
  }
  await auditBatch.commit();

  return { expiredCount: snap.docs.length };
});

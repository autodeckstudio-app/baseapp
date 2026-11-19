// Admin-only correction: give back one recorded interior refresh - the record
// was made in error, or the visit it was tied to was cancelled before the
// refresh was performed. Mirrors the covered-wash restore discipline: the
// historical row is never deleted (it is marked restored), the counter is
// decremented once, and the operation is idempotent. Restoring on an expired
// or cancelled membership is allowed: it corrects the record, and only an
// active plan can consume anyway.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership, MembershipRefreshUsage } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import {
  extractUser,
  assertRole,
  assertTenant,
} from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { restoreMembershipRefreshSchema } from "../../schemas/membership.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const restoreMembershipRefresh = onCall(
  { region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const user = extractUser(request);
    assertRole(user, "admin", "superadmin");

    const data = validate(restoreMembershipRefreshSchema, request.data);
    await enforceRateLimit(subjectFrom(user), "membership.refreshRestore");

    const db = getFirestore();
    const membershipRef = db
      .collection(COLLECTIONS.memberships())
      .doc(data.membershipId);
    const now = new Date().toISOString();

    return db.runTransaction(async (tx) => {
      const membershipSnap = await tx.get(membershipRef);
      if (!membershipSnap.exists)
        throw new HttpsError("not-found", "Membership not found.");
      const membership = membershipSnap.data() as Membership;
      assertTenant(user, membership.tenantId);

      const usageRef = db
        .collection(SUBCOLLECTIONS.membershipRefreshUsage(membership.id))
        .doc(data.refreshUsageId);
      const usageSnap = await tx.get(usageRef);
      if (!usageSnap.exists)
        throw new HttpsError("not-found", "Refresh record not found.");
      const row = usageSnap.data() as MembershipRefreshUsage;
      if (
        row.membershipId !== membership.id ||
        row.tenantId !== membership.tenantId ||
        row.customerId !== membership.customerId
      )
        throw new HttpsError(
          "failed-precondition",
          "Refresh record does not belong to this membership.",
        );
      const total = membership.refreshesTotal ?? 0;
      const used = membership.refreshesUsed ?? 0;
      if (row.restoredAt) {
        return {
          alreadyRestored: true,
          refreshesUsed: used,
          refreshesTotal: total,
        };
      }
      if (!Number.isSafeInteger(used) || used < 1)
        throw new HttpsError(
          "failed-precondition",
          "Refresh counter needs staff review before a restore.",
        );

      tx.update(usageRef, { restoredAt: now, restoredBy: user.uid });
      tx.update(membershipRef, { refreshesUsed: used - 1, updatedAt: now });
      writeAuditLog(tx, {
        action: "membership.refresh_restored",
        entityType: "Membership",
        entityId: membership.id,
        user,
        studioId: null,
        after: {
          refreshUsageId: row.id,
          jobId: row.jobId,
          reason: data.reason,
          refreshesRemaining: Math.max(0, total - (used - 1)),
        },
      });
      return {
        alreadyRestored: false,
        refreshesUsed: used - 1,
        refreshesTotal: total,
      };
    });
  },
);

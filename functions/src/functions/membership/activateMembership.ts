// Admin-only. Verifies the linked Payment has completed, then activates the
// membership: sets status=active, startDate=today, endDate=today+30 days
// (monthly subscription — MEMBERSHIP_DURATION_DAYS). Terms become immutable
// once active (doc06 Rule 7).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership } from "@autodeck/core";
import { MEMBERSHIP_DURATION_DAYS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { activateMembershipSchema } from "../../schemas/membership.js";

export const activateMembership = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(activateMembershipSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.activate");

  const db = getFirestore();
  const membershipRef = db.collection(COLLECTIONS.memberships()).doc(data.membershipId);

  const paymentSnap = await db
    .collection(COLLECTIONS.payments())
    .where("membershipId", "==", data.membershipId)
    .where("status", "==", "completed")
    .limit(1)
    .get();

  if (paymentSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot activate a membership with no completed payment.",
    );
  }

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(membershipRef);
    if (!snap.exists) throw new HttpsError("not-found", "Membership not found.");

    const membership = snap.data() as Membership;
    assertTenant(user, membership.tenantId);

    if (membership.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Cannot activate a membership with status ${membership.status}.`,
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const startDate = nowIso.slice(0, 10);
    const endDate = new Date(now.getTime() + MEMBERSHIP_DURATION_DAYS * 86400000)
      .toISOString()
      .slice(0, 10);

    tx.update(membershipRef, {
      status: "active",
      startDate,
      endDate,
      activatedAt: nowIso,
      activatedBy: user.uid,
      updatedAt: nowIso,
    });

    writeAuditLog(tx, {
      action: "membership.activated",
      entityType: "Membership",
      entityId: data.membershipId,
      user,
      studioId: null,
      before: { status: membership.status },
      after: { status: "active", startDate, endDate },
    });
  });

  return { membershipId: data.membershipId };
});

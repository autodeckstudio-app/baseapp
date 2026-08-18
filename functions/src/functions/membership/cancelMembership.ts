// Admin-only (doc08 §8.2: Studio "Cannot write: Membership terms, activation,
// or cancellation"; Admin "Special powers: Activate or cancel memberships").
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Membership } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { cancelMembershipSchema } from "../../schemas/membership.js";

export const cancelMembership = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(cancelMembershipSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.cancel");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.memberships()).doc(data.membershipId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Membership not found.");

    const membership = snap.data() as Membership;
    assertTenant(user, membership.tenantId);

    if (membership.status === "cancelled" || membership.status === "expired") {
      throw new HttpsError(
        "failed-precondition",
        `Membership is already ${membership.status}.`,
      );
    }

    const now = new Date().toISOString();
    tx.update(ref, {
      status: "cancelled",
      cancelledAt: now,
      cancelledBy: user.uid,
      cancellationReason: data.reason,
      updatedAt: now,
    });

    writeAuditLog(tx, {
      action: "membership.cancelled",
      entityType: "Membership",
      entityId: data.membershipId,
      user,
      studioId: null,
      before: { status: membership.status },
      after: { status: "cancelled", reason: data.reason },
    });
  });

  return { membershipId: data.membershipId };
});

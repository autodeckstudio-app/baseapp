import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { MembershipPlan } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { setMembershipPlanActiveSchema } from "../../schemas/membership.js";

export const setMembershipPlanActive = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(setMembershipPlanActiveSchema, request.data);

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.membershipPlans()).doc(data.planId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Membership plan not found.");

    const existing = snap.data() as MembershipPlan;
    assertTenant(user, existing.tenantId);

    tx.update(ref, { active: data.active, updatedAt: new Date().toISOString() });
    writeAuditLog(tx, {
      action: data.active ? "membership.plan_activated" : "membership.plan_deactivated",
      entityType: "MembershipPlan",
      entityId: data.planId,
      user,
      studioId: null,
      before: { active: existing.active },
      after: { active: data.active },
    });
  });

  return { planId: data.planId, active: data.active };
});

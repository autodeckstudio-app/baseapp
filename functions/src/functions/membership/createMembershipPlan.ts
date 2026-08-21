import { onCall } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { MembershipPlan } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createMembershipPlanSchema } from "../../schemas/membership.js";
import { assertValidMinorUnits } from "../../lib/pricing.js";

export const createMembershipPlan = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(createMembershipPlanSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.planCreate");
  assertValidMinorUnits(data.priceInPaise, "priceInPaise");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.membershipPlans()).doc();
  const now = new Date().toISOString();

  const plan: MembershipPlan = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    tier: data.tier,
    name: data.name,
    priceInPaise: data.priceInPaise,
    includedWashes: data.includedWashes,
    discountPercent: data.discountPercent,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, plan);
    writeAuditLog(tx, {
      action: "membership.plan_created",
      entityType: "MembershipPlan",
      entityId: ref.id,
      user,
      studioId: null,
      after: { id: ref.id, tier: plan.tier, name: plan.name, priceInPaise: plan.priceInPaise, active: true },
    });
  });

  return { plan };
});

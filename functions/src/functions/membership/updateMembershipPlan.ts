// Edits a MembershipPlan template. Never touches already-purchased Memberships —
// their terms were snapshotted at purchase time (doc06 Rule 7 / membership.ts comment).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { MembershipPlan } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateMembershipPlanSchema } from "../../schemas/membership.js";
import { assertValidMinorUnits } from "../../lib/pricing.js";

export const updateMembershipPlan = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(updateMembershipPlanSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "membership.planUpdate");
  if (data.priceInPaise !== undefined) assertValidMinorUnits(data.priceInPaise, "priceInPaise");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.membershipPlans()).doc(data.planId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Membership plan not found.");

    const existing = snap.data() as MembershipPlan;
    assertTenant(user, existing.tenantId);

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updates["name"] = data.name;
    if (data.priceInPaise !== undefined) updates["priceInPaise"] = data.priceInPaise;
    if (data.includedWashes !== undefined) updates["includedWashes"] = data.includedWashes;
    if (data.discountPercent !== undefined) updates["discountPercent"] = data.discountPercent;

    tx.update(ref, updates);
    writeAuditLog(tx, {
      action: "membership.plan_updated",
      entityType: "MembershipPlan",
      entityId: data.planId,
      user,
      studioId: null,
      before: {
        name: existing.name,
        priceInPaise: existing.priceInPaise,
        includedWashes: existing.includedWashes,
        discountPercent: existing.discountPercent,
      },
      after: updates,
    });
  });

  return { planId: data.planId };
});

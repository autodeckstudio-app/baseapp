import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateStudioSettingsSchema } from "../../schemas/studio.js";

// Admin-only. Updates name/timezone/operatingHours/tax settings for an existing
// studio. Does NOT create studios — V1 is single-studio per tenant, seeded once.
// Holidays and bays are mutated through their own dedicated functions.
export const updateStudioSettings = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(updateStudioSettingsSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "studio.updateSettings");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Studio not found.");

    const existing = snap.data() as StudioConfig;
    assertTenant(user, existing.tenantId);

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (data.name !== undefined) updates["name"] = data.name;
    if (data.timezone !== undefined) updates["timezone"] = data.timezone;
    if (data.operatingHours !== undefined) updates["operatingHours"] = data.operatingHours;
    if (data.taxRatePercent !== undefined) updates["taxRatePercent"] = data.taxRatePercent;
    if (data.taxDescription !== undefined) updates["taxDescription"] = data.taxDescription;

    tx.update(ref, updates);
    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "StudioConfig",
      entityId: data.studioId,
      user,
      studioId: data.studioId,
      before: {
        name: existing.name,
        timezone: existing.timezone,
        taxRatePercent: existing.taxRatePercent,
      },
      after: updates,
      metadata: { change: "settings_updated" },
    });
  });

  return { studioId: data.studioId };
});

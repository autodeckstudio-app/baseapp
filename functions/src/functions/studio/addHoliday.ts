import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { StudioConfig } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { addHolidaySchema } from "../../schemas/studio.js";

export const addHoliday = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(addHolidaySchema, request.data);
  await enforceRateLimit(subjectFrom(user), "studio.addHoliday");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(data.studioId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Studio not found.");

    const existing = snap.data() as StudioConfig;
    assertTenant(user, existing.tenantId);

    if (existing.holidays.includes(data.date)) {
      throw new HttpsError("already-exists", "Holiday already added for this date.");
    }

    tx.update(ref, {
      holidays: FieldValue.arrayUnion(data.date),
      updatedAt: new Date().toISOString(),
    });

    writeAuditLog(tx, {
      action: "studio.config_updated",
      entityType: "StudioConfig",
      entityId: data.studioId,
      user,
      studioId: data.studioId,
      after: { date: data.date, reason: data.reason ?? null },
      metadata: { change: "holiday.added" },
    });
  });

  return { studioId: data.studioId, date: data.date };
});

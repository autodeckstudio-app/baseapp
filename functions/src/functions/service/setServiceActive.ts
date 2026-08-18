import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { setServiceActiveSchema } from "../../schemas/service.js";

export const setServiceActive = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(setServiceActiveSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "service.setActive");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.services()).doc(data.serviceId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Service not found.");

    const existing = snap.data() as Service;
    assertTenant(user, existing.tenantId);

    tx.update(ref, { active: data.active, updatedAt: new Date().toISOString() });
    writeAuditLog(tx, {
      action: data.active ? "service.activated" : "service.deactivated",
      entityType: "Service",
      entityId: data.serviceId,
      user,
      studioId: null,
      before: { active: existing.active },
      after: { active: data.active },
    });
  });

  return { serviceId: data.serviceId, active: data.active };
});

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { archiveVehicleSchema } from "../../schemas/vehicle.js";

export const archiveVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");

  const data = validate(archiveVehicleSchema, request.data);

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new HttpsError("not-found", "Vehicle not found.");
    }

    const existing = snap.data() as Vehicle;

    assertTenant(user, existing.tenantId);

    if (user.claims.role === "customer" && existing.ownerId !== user.uid) {
      throw new HttpsError("permission-denied", "You do not own this vehicle.");
    }

    if (existing.deletedAt !== null) {
      throw new HttpsError("failed-precondition", "Vehicle is already archived.");
    }

    const now = new Date().toISOString();
    tx.update(ref, { deletedAt: now, updatedAt: now });

    writeAuditLog(tx, {
      action: "vehicle.archived",
      entityType: "Vehicle",
      entityId: data.vehicleId,
      user,
      studioId: null,
      before: { deletedAt: null },
      after: { deletedAt: now },
    });
  });

  return { vehicleId: data.vehicleId, archived: true };
});

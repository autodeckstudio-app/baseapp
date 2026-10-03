import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { restoreVehicleSchema } from "../../schemas/vehicle.js";

// Brings an archived car back with all its details. Same ownership rules as archiveVehicle.
export const restoreVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(restoreVehicleSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "vehicle.restore");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Vehicle not found.");
    const v = snap.data() as Vehicle;
    assertTenant(user, v.tenantId);
    if (user.claims.role === "customer" && v.ownerId !== user.uid) {
      throw new HttpsError("permission-denied", "You do not own this vehicle.");
    }
    if (v.deletedAt === null) throw new HttpsError("failed-precondition", "Vehicle is not archived.");
    const same = await tx.get(
      db.collection(COLLECTIONS.vehicles())
        .where("tenantId", "==", v.tenantId)
        .where("ownerId", "==", v.ownerId)
        .where("registrationNumber", "==", v.registrationNumber)
        .limit(10),
    );
    if (same.docs.some((d) => d.id !== ref.id && (d.data() as Vehicle).deletedAt === null)) {
      throw new HttpsError("already-exists", "This car is already added.");
    }
    const now = new Date().toISOString();
    tx.update(ref, { deletedAt: null, updatedAt: now });
    writeAuditLog(tx, {
      action: "vehicle.restored",
      entityType: "Vehicle",
      entityId: ref.id,
      user,
      studioId: null,
      before: { deletedAt: v.deletedAt },
      after: { deletedAt: null },
    });
  });
  return { vehicleId: data.vehicleId, restored: true };
});

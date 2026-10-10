import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { deleteVehicleSchema } from "../../schemas/vehicle.js";
import { permanentlyDeleteVehicle, VehicleDeleteError } from "../../lib/vehicle-delete.js";

// Permanently deletes ONE vehicle record (owner or admin, same tenant) after copying
// its details onto that car's bookings, jobs and invoices. History is kept.
export const deleteVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "admin", "superadmin");

  const data = validate(deleteVehicleSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "vehicle.delete");

  try {
    return await permanentlyDeleteVehicle(
      getFirestore(),
      { uid: user.uid, role: user.claims.role, tenantId: user.claims.tenantId },
      data.vehicleId,
      (tx, e) =>
        writeAuditLog(tx, {
          action: "vehicle.deleted",
          entityType: "Vehicle",
          entityId: e.vehicleId,
          user,
          studioId: null,
          before: { registrationNumber: e.snapshot.registrationNumber, ownerId: e.ownerId },
          after: { deleted: true },
        }),
    );
  } catch (err) {
    if (err instanceof VehicleDeleteError) throw new HttpsError(err.code, err.message);
    throw err;
  }
});

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { extractUser, assertRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { deleteVehicleSchema } from "../../schemas/vehicle.js";
import { permanentlyDeleteVehicle, deleteVehiclePhotos, recordVehiclePhotoCleanup, VehicleDeleteError } from "../../lib/vehicle-delete.js";

// Permanently deletes ONE vehicle record (owner or admin, same tenant) after copying
// its details onto that car's bookings, jobs and invoices. History is kept.
// After the record is gone, the car's own cover pictures are removed from
// Storage; inspection photos live under the job prefix and are always kept,
// and the RC photo plus paper-* documents are records, not pictures, so they
// are kept too.
export const deleteVehicle = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "admin", "superadmin");

  const data = validate(deleteVehicleSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "vehicle.delete");

  try {
    const result = await permanentlyDeleteVehicle(
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
    // The car is gone at this point, so a photo-sweep failure must not fail the
    // call: report it, log it, and let a retry (alreadyDeleted path) re-sweep.
    // Tenant comes from the verified actor claims, never from client input.
    let photos = { deleted: 0, failed: false };
    try {
      photos = await deleteVehiclePhotos(getStorage().bucket(), user.claims.tenantId, data.vehicleId);
    } catch (err) {
      photos = { deleted: 0, failed: true };
      logger.error("Vehicle photo cleanup failed after permanent delete", {
        vehicleId: data.vehicleId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (photos.failed) {
      logger.error("Vehicle photo cleanup left objects behind", { vehicleId: data.vehicleId });
    }
    // Durable truth on the tombstone: a failed sweep stays visible (and
    // retryable) after the car is gone from every UI. A failure here must not
    // fail the call either - the photos.failed flag still reports it.
    try {
      await recordVehiclePhotoCleanup(getFirestore(), user.claims.tenantId, data.vehicleId, photos);
    } catch (err) {
      logger.error("Vehicle photo cleanup status could not be recorded", {
        vehicleId: data.vehicleId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { ...result, photos };
  } catch (err) {
    if (err instanceof VehicleDeleteError) throw new HttpsError(err.code, err.message);
    throw err;
  }
});

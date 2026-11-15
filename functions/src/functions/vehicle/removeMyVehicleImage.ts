// Customer removes the cover photo or RC photo of their own car. Clears only that one image field and its Storage object.
// Never touches the car, its bookings, or its documents. Bookings already fall back to the category picture when there is no photo.
// Field clear + reap-queue enqueue happen in ONE transaction (the queue owns the actual
// object delete), so a remove can never clobber a concurrent publish or lose track of the object.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { removeMyVehicleImageSchema } from "../../schemas/vehicle.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import {
  drainVehiclePhotoReap,
  enqueueReap,
  isOwnPhotoPath,
  readQueue,
} from "../../lib/vehicle-photo-reap.js";

export const removeMyVehicleImage = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(removeMyVehicleImageSchema, request.data);
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  const isRc = data.kind === "rc";
  const field = isRc ? "rcPhotoUrl" : "photoUrl";

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Vehicle not found");
    const vehicle = snap.data() as Vehicle & Record<string, unknown>;
    assertTenant(user, vehicle.tenantId);
    if (vehicle.ownerId !== user.uid) throw new HttpsError("permission-denied", "You do not own this car.");
    const current = (vehicle[field] as string | null) ?? null;
    if (!current) return; // already empty - no-op
    const kindKey = isRc ? "rc" : "cover";
    const updates: Record<string, unknown> = { [field]: null, updatedAt: new Date().toISOString() };
    if (isOwnPhotoPath(current, vehicle.tenantId, data.vehicleId)) {
      updates.photoReapQueue = enqueueReap(readQueue(vehicle as Record<string, unknown>), current, kindKey);
      // Moving the field off a path MUST close legacy accept for this kind: otherwise a
      // failed/queued delete could be repointed by a legacy-accept publish of that same
      // path, and the next drain would delete the referenced object (reviewer fix 7).
      updates[`photoProtocol.${kindKey}`] = 1;
    }
    tx.update(ref, updates);
  });

  // The queue owns the delete; failed deletes stay queued and are retried by later drains.
  await drainVehiclePhotoReap(data.vehicleId, getStorage().bucket());
  return { removed: true };
});

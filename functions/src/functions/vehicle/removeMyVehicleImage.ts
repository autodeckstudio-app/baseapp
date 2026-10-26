// Customer removes the cover photo or RC photo of their own car. Clears only that one image field and its Storage object.
// Never touches the car, its bookings, or its documents. Bookings already fall back to the category picture when there is no photo.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { removeMyVehicleImageSchema } from "../../schemas/vehicle.js";

export const removeMyVehicleImage = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(removeMyVehicleImageSchema, request.data);
  const ref = getFirestore().collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Car not found.");
  const vehicle = snap.data() as Vehicle & { rcPhotoUrl?: string | null };
  assertTenant(user, vehicle.tenantId);
  if (vehicle.ownerId !== user.uid) throw new HttpsError("permission-denied", "You do not own this car.");
  const isRc = data.kind === "rc";
  const field = isRc ? "rcPhotoUrl" : "photoUrl";
  const path = (isRc ? vehicle.rcPhotoUrl : vehicle.photoUrl) ?? null;
  const prefix = `${vehicle.tenantId}/vehicles/${data.vehicleId}/${isRc ? "rc" : "cover"}.`;
  if (path && path.startsWith(prefix) && !path.includes("..")) {
    // Object first. If Storage fails the field stays, so a retry is safe. A missing object is fine.
    try { await getStorage().bucket().file(path).delete({ ignoreNotFound: true }); }
    catch { throw new HttpsError("unavailable", "Could not remove the image. Nothing was changed. Try again."); }
  }
  await ref.update({ [field]: null, updatedAt: new Date().toISOString() });
  return { removed: true };
});

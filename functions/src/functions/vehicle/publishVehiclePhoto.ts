// Makes a signed-URL-uploaded vehicle photo readable in the apps.
//
// Why this exists: the photo is uploaded straight to Storage through a signed
// PUT URL, so the object never gets a Firebase download token. The client SDK's
// getDownloadURL() needs that token and fails without it, so every screen fell
// back to the category picture. This callable stamps a fresh token on the
// object (after checking the caller owns the car and the path is that car's
// own cover file), optionally points the vehicle at it, and returns the URL.
// A new token per upload also changes the URL, so caches never serve the old photo.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { publishVehiclePhotoSchema } from "../../schemas/vehicle.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

export const publishVehiclePhoto = onCall({ region: "asia-south1" , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(publishVehiclePhotoSchema, request.data);

  const ref = getFirestore().collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Vehicle not found.");
  const vehicle = snap.data() as Vehicle;
  assertTenant(user, vehicle.tenantId);
  if (user.claims.role === "customer" && vehicle.ownerId !== user.uid) {
    throw new HttpsError("permission-denied", "You do not own this vehicle.");
  }
  const isRc = data.kind === "rc";
  const prefix = `${vehicle.tenantId}/vehicles/${data.vehicleId}/${isRc ? "rc" : "cover"}.`;
  if (!data.path.startsWith(prefix) || data.path.includes("..")) {
    throw new HttpsError("invalid-argument", "That is not this car's photo.");
  }

  const bucket = getStorage().bucket();
  const file = bucket.file(data.path);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Photo not found. Upload it again.");

  // P4: no standing download token. The immediate display uses a 10-minute
  // signed read URL; later views go through getPrivateFileUrl.
  const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60 * 1000 });

  if (data.publish) {
    await ref.update({ [isRc ? "rcPhotoUrl" : "photoUrl"]: data.path, updatedAt: new Date().toISOString() });
  }
  return { path: data.path, url };
});

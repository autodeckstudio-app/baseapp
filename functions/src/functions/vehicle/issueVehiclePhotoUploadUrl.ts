// Issues a short-lived signed PUT URL for a vehicle cover photo.
// The object path mirrors storage.rules: {tenantId}/vehicles/{vehicleId}/cover.<ext>,
// with customMetadata.ownerId stamped at upload so the hardened read rule
// (owner or studio only) applies from the first byte. See doc08 §8.8 pattern.
import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { issueVehiclePhotoUploadUrlSchema } from "../../schemas/vehicle.js";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export const issueVehiclePhotoUploadUrl = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");

  const data = validate(issueVehiclePhotoUploadUrlSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "vehicle.photoUpload");

  const db = getFirestore();
  const snap = await db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Vehicle not found.");
  }
  const vehicle = snap.data() as Vehicle;
  assertTenant(user, vehicle.tenantId);
  if (user.claims.role === "customer" && vehicle.ownerId !== user.uid) {
    throw new HttpsError("permission-denied", "You do not own this vehicle.");
  }

  const path = `${vehicle.tenantId}/vehicles/${data.vehicleId}/cover.${randomUUID()}.${EXT[data.contentType]}`;
  const [uploadUrl] = await getStorage()
    .bucket()
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + UPLOAD_WINDOW_MS,
      contentType: data.contentType,
      extensionHeaders: { "x-goog-meta-ownerId": vehicle.ownerId },
    });

  // The client must send these exact headers on the PUT or the signature fails.
  return {
    uploadUrl,
    path,
    requiredHeaders: {
      "Content-Type": data.contentType,
      "x-goog-meta-ownerId": vehicle.ownerId,
    },
  };
});

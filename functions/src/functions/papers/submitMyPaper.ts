import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { submitMyPaperSchema } from "../../schemas/paper.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Customer self-upload: the vehicle owner adds a document (RC, insurance, PUC,
// FASTag, other) for studio verification. Always lands PENDING. The owner is
// derived from the vehicle, never from the client. When contentType is given,
// returns a short-lived signed PUT URL for the photo.
export const submitMyPaper = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");
  const data = validate(submitMyPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");

  const db = getFirestore();
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get();
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
  const vehicle = vehicleSnap.data() as Vehicle;
  assertTenant(user, vehicle.tenantId);
  if (vehicle.ownerId !== user.uid) throw new HttpsError("permission-denied", "You do not own this vehicle.");

  const ref = db.collection(COLLECTIONS.papers()).doc();
  const now = new Date().toISOString();
  const path = data.contentType
    ? `${vehicle.tenantId}/vehicles/${data.vehicleId}/paper-${ref.id}.${EXT[data.contentType]}`
    : null;

  const paper: PaperVerification & { evidencePath: string | null; submittedBy: "customer" } = {
    id: ref.id,
    tenantId: vehicle.tenantId,
    studioId: data.studioId,
    vehicleId: data.vehicleId,
    customerId: vehicle.ownerId,
    kind: data.kind,
    reference: data.reference,
    issuedOn: data.issuedOn ?? null,
    expiresOn: data.expiresOn ?? null,
    evidenceUrl: null,
    evidencePath: path,
    submittedBy: "customer",
    status: "PENDING",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    notes: null,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(paper);

  let uploadUrl: string | null = null;
  let requiredHeaders: Record<string, string> | null = null;
  if (path && data.contentType) {
    [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000,
      contentType: data.contentType,
      extensionHeaders: { "x-goog-meta-ownerId": vehicle.ownerId },
    });
    requiredHeaders = { "Content-Type": data.contentType, "x-goog-meta-ownerId": vehicle.ownerId };
  }
  return { id: ref.id, uploadUrl, requiredHeaders };
});

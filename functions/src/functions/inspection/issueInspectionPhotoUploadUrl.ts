// Studio/admin only. Issues a short-lived signed PUT URL for one inspection
// (damage/condition) photo. The object lands at
// {tenantId}/jobs/{jobId}/photos/{uuid}.{ext} — the path storage.rules
// already scopes to studio staff of the tenant and the owning customer via
// customMetadata.customerId, stamped here at issue time so the hardened read
// rule applies from the first byte. Same doc08 §8.8 pattern as
// issueVehiclePhotoUploadUrl.
//
// Bound to the job's inspection, which must exist and still be in_progress:
// photos are intake/condition evidence, and a finalized inspection is
// immutable (finalizeInspection.ts), so issuing new upload URLs against it
// would orphan objects the inspection can never record. The client records
// the returned path on the inspection via updateInspection { addPhotos }
// after the PUT succeeds.
import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Inspection, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { issueInspectionPhotoUploadUrlSchema } from "../../schemas/inspection.js";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export const issueInspectionPhotoUploadUrl = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(issueInspectionPhotoUploadUrlSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inspection.photoUpload");

  const db = getFirestore();
  const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(data.jobId).get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Job not found.");
  const job = jobSnap.data() as ServiceJob;

  if (job.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (user.claims.role === "studio" && user.claims.studioId !== job.studioId) {
    throw new HttpsError("permission-denied", "Job belongs to a different studio.");
  }

  const inspectionSnap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
  if (!inspectionSnap.exists) {
    throw new HttpsError("failed-precondition", "Start the inspection for this job before adding photos.");
  }
  const inspection = inspectionSnap.data() as Inspection;
  if (inspection.status === "finalized") {
    throw new HttpsError("failed-precondition", "This inspection has already been finalized and cannot take new photos.");
  }

  const path = `${job.tenantId}/jobs/${job.id}/photos/${randomUUID()}.${EXT[data.contentType]}`;
  // x-goog-if-generation-match: 0 makes the URL create-only: GCS answers 412
  // if the object already exists, so the URL cannot overwrite bytes after
  // they were attached (and verified) or the inspection was finalized,
  // closing the same-path overwrite/reuse hole inside the 10-minute window.
  const requiredHeaders = {
    "Content-Type": data.contentType,
    "x-goog-meta-customerId": job.customerId,
    "x-goog-if-generation-match": "0",
  };
  const [uploadUrl] = await getStorage()
    .bucket()
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + UPLOAD_WINDOW_MS,
      contentType: data.contentType,
      extensionHeaders: requiredHeaders,
    });

  // The client must send these exact headers on the PUT or the signature fails.
  return { uploadUrl, path, requiredHeaders };
});

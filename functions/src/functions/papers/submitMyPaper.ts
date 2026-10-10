import { randomUUID } from "node:crypto";
import { z } from "zod";
import { logger } from "firebase-functions/v2";
import { decidePaper, type PaperDecision } from "../../lib/paper-verification.js";
import { readPaperImage } from "../../lib/paper-ocr.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { submitMyPaperSchema } from "../../schemas/paper.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Customer self-upload: the vehicle owner adds a document (RC, insurance, PUC,
// other) for automatic checks after upload. Starts PENDING. The owner is
// derived from the vehicle, never from the client. When contentType is given,
// returns a short-lived signed PUT URL for the photo.
export const submitMyPaper = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
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
    verificationMode: "review",
    verificationReason: path ? "Photo upload is awaiting automatic checks." : "No original photo uploaded. Manual review needed.",
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

// Called immediately after the signed upload completes. Only the owner can
// process the server-recorded object; client expiry/plate cannot approve it.
export const finalizeMyPaper = onCall({ region: "asia-south1", memory: "1GiB", timeoutSeconds: 120, concurrency: 1, maxInstances: 3 }, async (request) => {
  const user = extractCustomerUser(request);
  const { paperId } = validate(z.object({ paperId: z.string().min(1).max(120) }).strict(), request.data);
  await enforceRateLimit(subjectFrom(user), "paper.review");
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.papers()).doc(paperId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Document not found.");
  const paper = snap.data() as PaperVerification & { evidencePath?: string; submittedBy?: string };
  assertTenant(user, paper.tenantId);
  if (paper.customerId !== user.uid || paper.submittedBy !== "customer") throw new HttpsError("permission-denied", "Not your document.");
  if (paper.status !== "PENDING" || paper.verificationMode === "automatic") return { status: paper.status };
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get();
  const vehicle = vehicleSnap.data() as Vehicle | undefined;
  if (!vehicle || vehicle.ownerId !== user.uid || vehicle.tenantId !== paper.tenantId) throw new HttpsError("permission-denied", "Vehicle ownership changed.");
  const prefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.`;
  if (!paper.evidencePath?.startsWith(prefix) || paper.evidencePath.includes("..")) throw new HttpsError("failed-precondition", "Upload the original document photo first.");
  const file = getStorage().bucket().file(paper.evidencePath);
  let decision: PaperDecision = { status: "PENDING", reason: "The photo could not be read. Please review the original.", extractedPlate: null, extractedExpiry: null };
  let evidenceUrl: string | null = null;
  try {
    const [meta] = await file.getMetadata();
    if (Number(meta.size) > 10 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(meta.contentType ?? "")) throw new Error("Unsupported image");
    const token = randomUUID();
    await file.setMetadata({ metadata: { ...(meta.metadata ?? {}), firebaseStorageDownloadTokens: token } });
    evidenceUrl = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(paper.evidencePath)}?alt=media&token=${token}`;
    const [image] = await file.download();
    const result = await readPaperImage(image);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    decision = decidePaper(result.text, result.confidence, paper.kind, vehicle.registrationNumber, today);
  } catch (err) {
    logger.warn("Document OCR requires manual review", { paperId, message: err instanceof Error ? err.message : "OCR failed" });
  }
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data() as PaperVerification | undefined;
    if (!current || current.status !== "PENDING" || current.verificationMode === "manual") return;
    const now = new Date().toISOString();
    tx.update(ref, {
      status: decision.status,
      verificationMode: decision.status === "PENDING" ? "review" : "automatic",
      verificationReason: decision.reason,
      extractedPlate: decision.extractedPlate,
      extractedExpiry: decision.extractedExpiry,
      ...(decision.extractedExpiry ? { expiresOn: decision.extractedExpiry } : { expiresOn: null }),
      evidenceUrl,
      reviewedBy: decision.status === "PENDING" ? null : "system",
      reviewedAt: decision.status === "PENDING" ? null : now,
      rejectionReason: decision.status === "REJECTED" ? decision.reason : null,
      updatedAt: now,
    });
    writeAuditLog(tx, { action: "paper.reviewed", entityType: "paper", entityId: paperId, user: { ...user, uid: "system" }, studioId: paper.studioId,
      before: { status: current.status }, after: { status: decision.status, reason: decision.reason, kind: paper.kind, vehicleId: paper.vehicleId, registrationNumber: vehicle.registrationNumber }, metadata: { automatic: true } });
  });
  return { status: decision.status, reason: decision.reason };
});

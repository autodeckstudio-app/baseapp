// Private file reads. Storage objects for papers, licence photos and vehicle
// photos sit behind rules-gated paths; this callable is the ONLY read path,
// returning a short-lived v4 signed read URL after the same auth, tenant and
// ownership checks the Firestore read rules apply. It replaces the standing
// firebasestorage.googleapis.com token URLs (bearer, no expiry) that were
// previously minted on finalize/publish.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import type { Customer, PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";

import { assertPhotoProvenance } from "../../lib/photo-provenance.js";

const schema = z.object({
  kind: z.enum(["paper", "license", "vehiclePhoto", "inspectionPhoto"]),
  id: z.string().min(1).max(120),
  path: z.string().min(1).max(300).optional(),
}).strict();

const READ_WINDOW_MS = 10 * 60 * 1000;

export const getPrivateFileUrl = onCall({ region: "asia-south1", invoker: "public", timeoutSeconds: 60, concurrency: 80, maxInstances: 20, enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer", "studio", "admin", "superadmin");
  const data = validate(schema, request.data);
  await enforceRateLimit(subjectFrom(user), "file.read");
  const db = getFirestore();
  const customerDocId = user.claims.role === "customer" ? await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid) : null;

  // Re-read immediately before minting, too: object IO must not leave a stale
  // ownership proof if a transfer happens while the file is being checked.
  async function assertInspectionRead(): Promise<void> {
    const snap = await db.collection(COLLECTIONS.inspections()).doc(data.id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Inspection not found.");
    const inspection = snap.data() as { tenantId: string; customerId: string; vehicleId: string; photos: string[] };
    assertTenant(user, inspection.tenantId);
    if (!data.path || !Array.isArray(inspection.photos) || !inspection.photos.includes(data.path) || !data.path.startsWith(`${inspection.tenantId}/jobs/${data.id}/photos/`)) throw new HttpsError("permission-denied", "Not this inspection's photo.");
    if (user.claims.role === "customer") {
      const current = await db.collection(COLLECTIONS.vehicles()).doc(inspection.vehicleId).get();
      const proof = current.exists ? current : await db.collection(COLLECTIONS.deletedVehicles()).doc(inspection.vehicleId).get();
      const owner = proof.data() as {ownerId?: string; tenantId?: string} | undefined;
      if (inspection.customerId !== customerDocId || !owner || owner.ownerId !== customerDocId || owner.tenantId !== inspection.tenantId) throw new HttpsError("permission-denied", "This inspection belongs to an earlier ownership record.");
    }
  }

  let path: string | null = null;
  let assertPaperRead: (() => Promise<void>) | null = null;
  let vehicleRef: ReturnType<ReturnType<typeof getFirestore>["doc"]> | null = null;
  let checkedPaperGeneration: string | null = null;
  let uploadedPaperGeneration: string | null = null;
  let expectedPrefix: string | null = null;
  if (data.kind === "inspectionPhoto") {
    await assertInspectionRead();
    path = data.path ?? null;
  } else if (data.kind === "paper") {
    const snap = await db.collection(COLLECTIONS.papers()).doc(data.id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Document not found.");
    const paper = snap.data() as PaperVerification & { evidencePath?: string | null; evidenceGeneration?: string | null };
    assertTenant(user, paper.tenantId);
    assertStudio(user, paper.studioId, "Paper");
    // Fresh CURRENT vehicle proof, not the record's stored customerId alone: after a transfer
    // or archive the former owner must not keep minting reads against a stale record.
    const vSnap = await db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get();
    const vehicle = vSnap.data() as Vehicle | undefined;
    if (!vSnap.exists || !vehicle || vehicle.tenantId !== paper.tenantId || vehicle.deletedAt) {
      throw new HttpsError("failed-precondition", "This document's car is not available.");
    }
    if (user.claims.role === "customer" && (paper.customerId !== customerDocId || vehicle.ownerId !== customerDocId)) {
      throw new HttpsError("permission-denied", "Not your document.");
    }
    assertPaperRead = async () => {
      const [freshPaperSnap, freshVehicleSnap] = await Promise.all([db.collection(COLLECTIONS.papers()).doc(data.id).get(), db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get()]);
      const freshPaper = freshPaperSnap.data() as typeof paper | undefined;
      const freshVehicle = freshVehicleSnap.data() as Vehicle | undefined;
      if (!freshPaper || !freshVehicle || freshVehicle.deletedAt || freshVehicle.tenantId !== paper.tenantId || freshPaper.tenantId !== paper.tenantId || freshPaper.vehicleId !== paper.vehicleId || freshPaper.customerId !== paper.customerId || freshPaper.evidencePath !== paper.evidencePath || freshPaper.evidenceGeneration !== paper.evidenceGeneration || (freshPaper as {uploadedGeneration?:string|null}).uploadedGeneration !== (paper as {uploadedGeneration?:string|null}).uploadedGeneration) throw new HttpsError("failed-precondition", "This document changed. Open it again.");
      assertStudio(user, freshPaper.studioId, "Paper");
      if (user.claims.role === "customer" && (freshPaper.customerId !== customerDocId || freshVehicle.ownerId !== customerDocId)) throw new HttpsError("permission-denied", "Not your document.");
    };
    path = paper.evidencePath ?? null;
    // The record's identity comes from the document path (the request id), never from a stored
    // field: a record whose stored id contradicts its own document id is corrupt and refused.
    if (paper.id !== undefined && paper.id !== snap.id) throw new HttpsError("failed-precondition", "This document's record is inconsistent.");
    checkedPaperGeneration = paper.evidenceGeneration ?? null;
    uploadedPaperGeneration = (paper as { uploadedGeneration?: string | null }).uploadedGeneration ?? null;
    // The stored path must belong to THIS record's own prefix, never an arbitrary object.
    expectedPrefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${snap.id}.`;
  } else if (data.kind === "license") {
    const snap = await db.collection(COLLECTIONS.customers()).doc(data.id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Customer not found.");
    const customer = snap.data() as Customer & { licensePhotoUrl?: string | null };
    assertTenant(user, customer.tenantId);
    if (user.claims.role === "customer" && data.id !== customerDocId) throw new HttpsError("permission-denied", "Not your profile.");
    path = customer.licensePhotoUrl ?? null;
  } else {
    vehicleRef = db.collection(COLLECTIONS.vehicles()).doc(data.id);
    const snap = await vehicleRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Vehicle not found.");
    const vehicle = snap.data() as Vehicle & { photoUrl?: string | null; rcPhotoUrl?: string | null };
    assertTenant(user, vehicle.tenantId);
    if (vehicle.deletedAt) throw new HttpsError("failed-precondition", "This car is archived.");
    if (user.claims.role === "customer" && vehicle.ownerId !== customerDocId) throw new HttpsError("permission-denied", "You do not own this vehicle.");
    // The caller names the exact stored photo it wants; it must be one of the
    // record's own photo paths, never an arbitrary object in the bucket.
    path = data.path && (data.path === vehicle.photoUrl || data.path === vehicle.rcPhotoUrl) ? data.path : null;
  }
  if (!path) throw new HttpsError("not-found", "No file stored for this record.");
  if (path.includes("..")) throw new HttpsError("failed-precondition", "Stored path is invalid.");
  if (expectedPrefix && !path.startsWith(expectedPrefix)) throw new HttpsError("failed-precondition", "Stored path is invalid.");
  // Version-pinned reads (papers): the record carries the generation of the exact bytes it
  // knows - the CHECKED generation after verification, or the UPLOADED generation while a
  // decision is still pending. Either way the read URL must open EXACTLY that version: a
  // path-only URL would silently open different bytes if the object were ever replaced. A
  // checked mismatch and an uploaded mismatch say different things, so their wordings differ.
  const pinnedGeneration = data.kind === "paper" ? (checkedPaperGeneration ?? uploadedPaperGeneration) : null;
  const pinnedIsChecked = data.kind === "paper" && (checkedPaperGeneration !== null && checkedPaperGeneration !== undefined);
  let file = getStorage().bucket().file(path);
  if (pinnedGeneration) {
    const [meta] = await file.getMetadata().catch((e: { code?: number }) => {
      // Only a genuine absence is "gone"; network/permission failures are transient.
      if (e?.code === 404) throw new HttpsError("not-found", "The stored file is gone.");
      throw new HttpsError("unavailable", "Could not confirm the stored file. Try again.");
    });
    const live = (meta.generation !== null && meta.generation !== undefined) ? String(meta.generation) : null;
    if (live !== pinnedGeneration) {
      throw new HttpsError("failed-precondition", pinnedIsChecked
        ? "The checked photo is no longer available in its verified form. Ask the customer to upload the document again."
        : "The uploaded photo is not the one this record received. It has not been checked; ask the customer to upload the document again.");
    }
    file = getStorage().bucket().file(path, { generation: pinnedGeneration });
  } else {
    const [exists] = await file.exists().catch((e: { code?: number }) => {
      if (e?.code === 404) return [false];
      throw new HttpsError("unavailable", "Could not confirm the stored file. Try again.");
    });
    if (!exists) throw new HttpsError("not-found", "The stored file is gone.");
  }
  if (data.kind === "vehiclePhoto" && user.claims.role === "customer") {
    await assertPhotoProvenance(file, customerDocId!);
    const fresh = (await vehicleRef!.get()).data() as Vehicle | undefined;
    if (!fresh || fresh.ownerId !== customerDocId || fresh.tenantId !== user.claims.tenantId || fresh.deletedAt || (path !== fresh.photoUrl && path !== fresh.rcPhotoUrl)) {
      throw new HttpsError("permission-denied", "Vehicle ownership or photo changed. Try again.");
    }
  }
  if (assertPaperRead) await assertPaperRead();
  if (data.kind === "inspectionPhoto") await assertInspectionRead();
  // Known limit, by design: a signed read URL stays usable for up to READ_WINDOW_MS after it
  // is minted. A transfer or archive landing in that window does NOT instantly revoke it -
  // the fresh ownership/tenant/archive checks above gate the MINT, not the bearer URL itself.
  const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + READ_WINDOW_MS });
  return { url, expiresInSeconds: READ_WINDOW_MS / 1000 };
});

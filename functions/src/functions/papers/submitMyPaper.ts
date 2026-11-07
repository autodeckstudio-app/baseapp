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
import { assertNumberUnused, isActivePaper, readClaims, PAPER_LOCKS } from "../../lib/paper-numbers.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type SubmitReply = { id: string; uploadUrl: string | null; requiredHeaders: Record<string, string> | null; photoState: "none" | "awaiting_upload" | "uploaded"; replayed?: boolean };

/** Deterministic operation-lock id: one per (tenant, customer, submissionId). Written with the
 * created record in the same transaction and NEVER deleted afterwards - it is the tombstone
 * that makes a completed, superseded or deleted submission replay its outcome, never recreate. */
const opLockId = (tenantId: string, customerId: string, submissionId: string): string =>
  `op__${tenantId}__${customerId}__${submissionId}`;

/** Immutable snapshot of the submission, written once at creation and never mutated. finalize
 * may rewrite mutable record fields (e.g. the OCR-derived expiry) - the retry contract compares
 * against THIS, so a decided record still replays its original submission. */
type SubmissionSnapshot = {
  submissionId: string;
  studioId: string; vehicleId: string; kind: string; reference: string;
  title: string | null; issuedOn: string | null; expiresOn: string | null; contentType: string | null;
  expectedContentMd5: string | null;
};

// Customer self-upload: the vehicle owner adds a document (RC, insurance, PUC,
// other) for automatic checks after upload. Starts PENDING. The owner is
// derived from the vehicle, never from the client. When contentType is given,
// returns a short-lived signed PUT URL for the photo.
export const submitMyPaper = onCall({ region: "asia-south1", timeoutSeconds: 60, concurrency: 80, maxInstances: 20, enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(submitMyPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.submit");

  const db = getFirestore();
  // Records key on the customer DOCUMENT id: a claimed walk-in's doc id differs from the auth uid.
  const customerDocId = await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid);
  const vehicleRef = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  const vehicleSnap = await vehicleRef.get();
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
  const vehicle = vehicleSnap.data() as Vehicle;
  assertTenant(user, vehicle.tenantId);
  if (vehicle.ownerId !== customerDocId) throw new HttpsError("permission-denied", "You do not own this vehicle.");
  if (vehicle.deletedAt) throw new HttpsError("failed-precondition", "This car is archived.");

  // Operation-identity replay: the client generates one submissionId per add-document
  // form session and resends it on retry. A retry of the SAME submission (the first
  // attempt created the record and reserved the number, but its acknowledgement was
  // lost) returns the record it created, with a fresh upload URL - never a second
  // record and never another, unrelated document. Identity is the op id PLUS the
  // immutable payload: the same id with different details is a conflict the owner
  // resolves explicitly (delete the earlier record or keep it), never a silent overwrite.
  const resolveReplay = async (): Promise<SubmitReply | null> => {
    if (!data.submissionId) return null;
    // Fresh ownership/tenant/archive gate BEFORE anything is returned or minted.
    const vSnap = await vehicleRef.get();
    const v = vSnap.data() as Vehicle | undefined;
    if (!vSnap.exists || !v || v.ownerId !== customerDocId || v.tenantId !== vehicle.tenantId || v.deletedAt) {
      throw new HttpsError("failed-precondition", "This car is not available for this submission.");
    }
    // The operation lock is the submission's tombstone: it survives replacement and deletion,
    // so a completed op can never be recreated by a retry.
    const opSnap = await db.collection(PAPER_LOCKS).doc(opLockId(vehicle.tenantId, customerDocId, data.submissionId)).get();
    if (!opSnap.exists) return null; // no earlier attempt of this submission
    const lock = opSnap.data() as { paperId: string; tenantId?: string; customerId?: string; vehicleId?: string };
    // The lock's immutable identity must match THIS request and tenant - a lock row that
    // disagrees is not proof of anything and fails closed.
    if (lock.tenantId !== vehicle.tenantId || lock.customerId !== customerDocId || lock.vehicleId !== data.vehicleId) {
      throw new HttpsError("aborted", "This submission conflicts with an existing record. Open your documents and review it before adding again.");
    }
    const opPaperId = lock.paperId;
    const existingSnap = await db.collection(COLLECTIONS.papers()).doc(opPaperId).get();
    if (!existingSnap.exists) {
      throw new HttpsError("failed-precondition", "This submission was already completed and its document was later removed. Close this form and add the document again.");
    }
    const existing = existingSnap.data() as PaperVerification & { submittedBy?: string; submission?: SubmissionSnapshot | null; evidencePath?: string | null; pendingEvidencePath?: string | null };
    // The locked document's own identity must match the request: tenant, owner, vehicle.
    if (existing.id !== opPaperId || existing.tenantId !== vehicle.tenantId || existing.customerId !== customerDocId || existing.vehicleId !== data.vehicleId) {
      throw new HttpsError("aborted", "This submission conflicts with an existing record. Open your documents and review it before adding again.");
    }
    const snap = existing.submission;
    if (!snap || snap.submissionId !== data.submissionId || existing.submittedBy !== "customer") {
      throw new HttpsError("aborted", "This submission conflicts with an existing record. Open your documents and review it before adding again.");
    }
    const samePayload =
      snap.vehicleId === data.vehicleId && snap.kind === data.kind && snap.reference === data.reference && snap.studioId === data.studioId &&
      (snap.title ?? null) === (data.title ?? null) && (snap.issuedOn ?? null) === (data.issuedOn ?? null) &&
      (snap.expiresOn ?? null) === (data.expiresOn ?? null) && (snap.contentType ?? null) === (data.contentType ?? null) &&
      // The declared digest is immutable payload too: a same-MIME retry carrying DIFFERENT
      // bytes is a different document photo, not a retry - conflict before any return or mint.
      (snap.expectedContentMd5 ?? null) === (data.contentMd5 ?? null);
    if (!samePayload) {
      throw new HttpsError("aborted", "Your earlier attempt to add this document used different details and is still on file. Check the saved record in your documents, or close this form and start a new entry.");
    }
    if (existing.supersededAt) {
      throw new HttpsError("failed-precondition", "This submission was already completed and its document has since been replaced. Close this form and add the document again.");
    }
    // Checked-bytes integrity: when a decision recorded the object generation, the live object
    // must still BE that version - a decided record whose evidence was replaced out-of-band
    // fails closed instead of blandly replaying "decided" over swapped bytes.
    const recordedGeneration = (existing as { evidenceGeneration?: string | null }).evidenceGeneration ?? null;
    const existingPath0 = existing.evidencePath ?? null;
    if (recordedGeneration) {
      if (!existingPath0) throw new HttpsError("aborted", "The stored photo no longer matches the checked upload. Check the saved record in your documents, or close this form and start a new entry.");
      try {
        const [m0] = await getStorage().bucket().file(existingPath0).getMetadata();
        const live0 = (m0.generation !== null && m0.generation !== undefined) ? String(m0.generation) : null;
        if (live0 !== recordedGeneration) throw new HttpsError("aborted", "The stored photo no longer matches the checked upload. Check the saved record in your documents, or close this form and start a new entry.");
      } catch (e) {
        if (e instanceof HttpsError) throw e;
        if ((e as { code?: number } | null)?.code !== 404) throw new HttpsError("unavailable", "Could not confirm the earlier upload. Try again.");
        throw new HttpsError("aborted", "The stored photo no longer matches the checked upload. Check the saved record in your documents, or close this form and start a new entry.");
      }
    }
    // Already decided, or an edit staged its own replacement: nothing to upload. The record's
    // current state is the answer; finalizing the edit's staging belongs to the edit flow.
    if (existing.status !== "PENDING" || existing.pendingEvidencePath) return { id: existing.id, uploadUrl: null, requiredHeaders: null, photoState: "none", replayed: true };
    if (!data.contentType) return { id: existing.id, uploadUrl: null, requiredHeaders: null, photoState: "none", replayed: true };
    const existingPath = existing.evidencePath ?? null;
    const prefix = `${existing.tenantId}/vehicles/${existing.vehicleId}/paper-${existing.id}.`;
    if (!existingPath || !existingPath.startsWith(prefix) || existingPath.includes("..") || !existingPath.endsWith(`.${EXT[data.contentType]}`)) {
      throw new HttpsError("aborted", "Your earlier attempt to add this document stored its photo differently. Check the saved record in your documents, or close this form and start a new entry.");
    }
    // If the bytes already landed (whatever path the record's CURRENT evidence lives at), the
    // upload is DONE: minting another PUT URL would let different bytes overwrite evidence the
    // checks may already have seen. Skip to finalize - it finalizes the CURRENT path, which may
    // be a staged replacement; that is the record's truth, never a restoration of the original.
    let objectExists = false;
    try {
      await getStorage().bucket().file(existingPath).getMetadata();
      objectExists = true;
    }
    catch (e) { if ((e as { code?: number } | null)?.code !== 404) throw new HttpsError("unavailable", "Could not confirm the earlier upload. Try again."); }
    if (objectExists) return { id: existing.id, uploadUrl: null, requiredHeaders: null, photoState: "uploaded", replayed: true };
    // Bytes are missing: a re-mint is only ever allowed for the op's OWN deterministic path. If
    // the record's current evidence is anything else (a staged replacement's suffixed path whose
    // object is gone), the original attempt is stale: the record's state is the answer, and
    // re-uploading belongs to the edit flow - never mint this form's URL over another path.
    const opPath = `${existing.tenantId}/vehicles/${existing.vehicleId}/paper-${existing.id}.${EXT[data.contentType]}`;
    if (existingPath !== opPath) return { id: existing.id, uploadUrl: null, requiredHeaders: null, photoState: "none", replayed: true };
    const [url] = await getStorage().bucket().file(existingPath).getSignedUrl({
      version: "v4", action: "write", expires: Date.now() + 10 * 60 * 1000,
      contentType: data.contentType,
      // Create-only: the PUT succeeds only while the object does not exist. This binds the
      // bytes across EVERY outstanding write URL for this path (first attempt, replay mint):
      // the first successful upload wins and any later PUT - same MIME, different bytes -
      // fails 412 instead of silently replacing evidence the checks may already have seen.
      extensionHeaders: { "x-goog-meta-ownerId": customerDocId, "x-goog-if-generation-match": "0", ...(data.contentMd5 ? { "Content-MD5": data.contentMd5 } : {}) },
    });
    return { id: existing.id, uploadUrl: url, requiredHeaders: { "Content-Type": data.contentType, "x-goog-meta-ownerId": customerDocId, "x-goog-if-generation-match": "0", ...(data.contentMd5 ? { "Content-MD5": data.contentMd5 } : {}) }, photoState: "awaiting_upload", replayed: true };
  };

  {
    const replay = await resolveReplay();
    if (replay) return replay;
  }
  try {
  // Round 7 point 5: one active RC per car. A second RC is an edit, not a new record.
  if (data.kind === "RC") {
    const existing = await db.collection(COLLECTIONS.papers()).where("vehicleId", "==", data.vehicleId).where("customerId", "==", customerDocId).get();
    if (existing.docs.some((d) => { const p = d.data() as PaperVerification; return p.kind === "RC" && isActivePaper(p); })) {
      throw new HttpsError("already-exists", "This car already has an RC. Edit it to replace it.");
    }
  }
  await assertNumberUnused(db, { tenantId: vehicle.tenantId, customerId: customerDocId, reference: data.reference });

  const ref = db.collection(COLLECTIONS.papers()).doc();
  const now = new Date().toISOString();
  const path = data.contentType
    ? `${vehicle.tenantId}/vehicles/${data.vehicleId}/paper-${ref.id}.${EXT[data.contentType]}`
    : null;

  const submission: SubmissionSnapshot | null = data.submissionId
    ? {
        submissionId: data.submissionId, studioId: data.studioId, vehicleId: data.vehicleId, kind: data.kind,
        reference: data.reference, title: data.title ?? null, issuedOn: data.issuedOn ?? null,
        expiresOn: data.expiresOn ?? null, contentType: data.contentType ?? null,
        expectedContentMd5: data.contentMd5 ?? null,
      }
    : null;
  const paper: PaperVerification & { evidencePath: string | null; submittedBy: "customer"; submissionId: string | null; submission: SubmissionSnapshot | null; expectedContentMd5: string | null; revision: number } = {
    id: ref.id,
    tenantId: vehicle.tenantId,
    studioId: data.studioId,
    vehicleId: data.vehicleId,
    customerId: vehicle.ownerId,
    kind: data.kind,
    reference: data.reference,
    ...(data.title ? { title: data.title } : {}),
    issuedOn: data.issuedOn ?? null,
    expiresOn: data.expiresOn ?? null,
    evidenceUrl: null,
    evidencePath: path,
    submittedBy: "customer",
    submissionId: data.submissionId ?? null,
    submission,
    // The declared digest of the CURRENT evidencePath, persisted on the record itself so the
    // binding holds even for a submit without an op id (no snapshot). Bound to the exact path:
    // edits leave it while the path lives, promotion swaps in the staged digest, removal clears it.
    expectedContentMd5: data.contentMd5 ?? null,
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
    revision: 0,
  };
  // Mint the upload URL BEFORE any write. If signing fails, nothing has been created: no orphan
  // PENDING paper and no number held by a submission the customer was told failed.
  let uploadUrl: string | null = null;
  let requiredHeaders: Record<string, string> | null = null;
  if (path && data.contentType) {
    [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000,
      contentType: data.contentType,
      // Content-MD5 is signed INTO the URL: GCS itself rejects a PUT whose bytes do not match
      // the digest the client declared. This is a byte-corruption/mismatch binding (MD5 is not
      // collision-resistant); version identity comes from the generation pin, not the digest.
      extensionHeaders: { "x-goog-meta-ownerId": vehicle.ownerId, "x-goog-if-generation-match": "0", ...(data.contentMd5 ? { "Content-MD5": data.contentMd5 } : {}) },
    });
    requiredHeaders = { "Content-Type": data.contentType, "x-goog-meta-ownerId": vehicle.ownerId, "x-goog-if-generation-match": "0", ...(data.contentMd5 ? { "Content-MD5": data.contentMd5 } : {}) };
  }

  // Both writes in one transaction with lock documents: two concurrent submits for the same number, or two RCs on one car, cannot both succeed.
  await db.runTransaction(async (tx) => {
    // Fresh vehicle re-read inside the transaction: the pre-read above only
    // gated URL signing. A transfer, archive or tenant change landing
    // between the pre-read and this commit must not let the write through.
    const freshVehicleSnap = await tx.get(vehicleRef);
    if (!freshVehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
    const freshVehicle = freshVehicleSnap.data() as Vehicle;
    assertTenant(user, freshVehicle.tenantId);
    if (freshVehicle.ownerId !== customerDocId) throw new HttpsError("permission-denied", "You do not own this vehicle.");
    if (freshVehicle.deletedAt) throw new HttpsError("failed-precondition", "This car is archived.");
    // The operation lock is checked and set INSIDE this transaction: two concurrent first
    // attempts of the same submission (even with different numbers) cannot both create.
    const opRef = data.submissionId
      ? db.collection(PAPER_LOCKS).doc(opLockId(freshVehicle.tenantId, customerDocId, data.submissionId))
      : null;
    if (opRef) {
      const opSnap = await tx.get(opRef);
      if (opSnap.exists) throw new HttpsError("already-exists", "This submission is already recorded.");
    }
    const claims = await readClaims(tx, db, { tenantId: freshVehicle.tenantId, customerId: customerDocId, vehicleId: data.vehicleId, paperId: ref.id, reference: data.reference, kind: data.kind, claimRc: data.kind === "RC" });
    tx.set(ref, paper);
    if (opRef) tx.set(opRef, { paperId: ref.id, tenantId: freshVehicle.tenantId, customerId: customerDocId, vehicleId: data.vehicleId });
    for (const c of claims) tx.set(c.ref, c.data);
  });

  return { id: ref.id, uploadUrl, requiredHeaders, photoState: path ? ("awaiting_upload" as const) : ("none" as const) };
  } catch (e) {
    // Lost the number/RC race inside the transaction (concurrent first attempts of this
    // same submission, e.g. a double-tap): if the winner IS this submission, replay it.
    if (e instanceof HttpsError && e.code === "already-exists") {
      const replay = await resolveReplay();
      if (replay) return replay;
    }
    throw e;
  }
});

// Called immediately after the signed upload completes. Only the owner can
// process the server-recorded object; client expiry/plate cannot approve it.
export const finalizeMyPaper = onCall({ region: "asia-south1", invoker: "public", memory: "1GiB", timeoutSeconds: 120, concurrency: 1, maxInstances: 3 , enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractCustomerUser(request);
  const { paperId } = validate(z.object({ paperId: z.string().min(1).max(120) }).strict(), request.data);
  await enforceRateLimit(subjectFrom(user), "paper.review");
  const db = getFirestore();
  // Records key on the customer DOCUMENT id: a claimed walk-in's doc id differs from the auth uid.
  const customerDocId = await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid);
  const ref = db.collection(COLLECTIONS.papers()).doc(paperId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Document not found.");
  const paper = snap.data() as PaperVerification & { evidencePath?: string; pendingEvidencePath?: string | null; submittedBy?: string };
  assertTenant(user, paper.tenantId);
  if (paper.customerId !== customerDocId || paper.submittedBy !== "customer") throw new HttpsError("permission-denied", "Not your document.");
  if (paper.status !== "PENDING" || paper.verificationMode === "automatic") return { status: paper.status };
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get();
  const vehicle = vehicleSnap.data() as Vehicle | undefined;
  if (!vehicle || vehicle.ownerId !== customerDocId || vehicle.tenantId !== paper.tenantId) throw new HttpsError("permission-denied", "Vehicle ownership changed.");
  const prefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.`;
  // A replacement photo is staged on the record as pendingEvidencePath by updateMyPaper; the current
  // evidence keeps serving until the new object is confirmed here. Fresh uploads use evidencePath directly.
  const pending = paper.pendingEvidencePath ?? null;
  const effectivePath = pending ?? paper.evidencePath;
  if (!effectivePath?.startsWith(prefix) || effectivePath.includes("..")) throw new HttpsError("failed-precondition", "Upload the original document photo first.");
  const file = getStorage().bucket().file(effectivePath);
  let decision: PaperDecision = { status: "PENDING", reason: "The photo could not be read. Please review the original.", extractedPlate: null, extractedExpiry: null };
  let observedGeneration: string | null = null;
  try {
    const [meta] = await file.getMetadata();
    // Object-version identity: generations are opaque 64-bit values assigned per write (GCS
    // docs; the first write is NOT generation 1). The create-only mint precondition already
    // guarantees a single successful write at this path via any URL we minted; the observed
    // generation is recorded with the decision so any LATER reader can prove the bytes are
    // still the exact object the checks ran against.
    observedGeneration = (meta.generation !== null && meta.generation !== undefined) ? String(meta.generation) : null;
    // No generation means the object's version identity cannot be established: fail closed
    // rather than check unpinned bytes.
    if (!observedGeneration) throw new HttpsError("failed-precondition", "Could not confirm the uploaded photo's version. Upload it again.");
    // Content identity: the digest the client declared at mint time (signed into the URL and
    // stored with the submission / staging) must equal the object's actual MD5. GCS already
    // enforced it at PUT time; this compare proves the object the checks run against is still
    // exactly those bytes. Records predating digests carry no expectation and skip the compare.
    // The CURRENT path's expectation wins. The immutable submission snapshot keeps the ORIGINAL
    // upload's digest forever - after a replacement is promoted, that old hash would wrongly
    // fail the new evidence's finalize. Property PRESENCE decides: an explicit null on the
    // record means "this path has no expectation" (no compare); only a record written before
    // the field existed (property absent) falls back to the snapshot, which itself may be absent.
    const recExpectation = (paper as { expectedContentMd5?: string | null });
    const expectedMd5 = pending
      ? ((paper as { pendingContentMd5?: string | null }).pendingContentMd5 ?? null)
      : (Object.prototype.hasOwnProperty.call(recExpectation, "expectedContentMd5")
          ? (recExpectation.expectedContentMd5 ?? null)
          : ((paper as { submission?: { expectedContentMd5?: string | null } | null }).submission?.expectedContentMd5 ?? null));
    if (expectedMd5 && meta.md5Hash !== expectedMd5) {
      // A missing md5Hash with a recorded expectation is a fail-closed case too: the object's
      // content identity cannot be proven (GCS always sets md5Hash on a plain object).
      throw new HttpsError("failed-precondition", "The uploaded photo is not the upload this record approved. Upload the photo again.");
    }
    if (Number(meta.size) > 10 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(meta.contentType ?? "")) throw new Error("Unsupported image");
    // Download the EXACT observed generation, kept as a string: generations are opaque 64-bit
    // values and Number() would round them. The checked bytes are the same object version
    // whose identity is recorded with the decision, immune to a swap between the metadata
    // read and the download. A stale pinned version 404s -> fail closed below.
    const pinned = getStorage().bucket().file(effectivePath, { generation: observedGeneration });
    let image: Buffer;
    try {
      [image] = await pinned.download();
    } catch (e) {
      if ((e as { code?: number } | null)?.code === 404) {
        throw new HttpsError("failed-precondition", "The uploaded photo's checked version is no longer available. Upload the photo again so its checks run against one current original.");
      }
      throw e;
    }
    const result = await readPaperImage(image);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    decision = decidePaper(result.text, result.confidence, paper.kind, vehicle.registrationNumber, today);
  } catch (err) {
    if (err instanceof HttpsError) throw err; // generation/precondition failures fail closed, never a manual-review pass
    logger.warn("Document OCR requires manual review", { paperId, message: err instanceof Error ? err.message : "OCR failed" });
    if (pending) {
      // The staged object never landed (or is unreadable): keep the existing evidence exactly as it was.
      // The record stays in manual review; the owner can retry finalize or re-edit. Nothing is promoted,
      // nothing is deleted, and the previous photo keeps serving.
      return { status: "PENDING", reason: "The new photo could not be read. The previous photo is still on file." };
    }
  }
  let promoted = false;
  let committed = false;
  await db.runTransaction(async (tx) => {
    promoted = false; // reflects only the attempt that finally commits
    committed = false;
    // Fresh identity re-read inside the transaction, after the OCR work:
    // the owner/tenant/archive checks above ran before a long download and
    // OCR, and a transfer or edit could have landed meanwhile.
    const [currentSnap, freshVehicleSnap] = await Promise.all([tx.get(ref), tx.get(db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId))]);
    const current = currentSnap.data() as (PaperVerification & { evidencePath?: string | null; pendingEvidencePath?: string | null; revision?: number }) | undefined;
    if (!current || current.status !== "PENDING" || current.verificationMode === "manual") return;
    const freshVehicle = freshVehicleSnap.data() as Vehicle | undefined;
    if (!freshVehicleSnap.exists || !freshVehicle || freshVehicle.ownerId !== customerDocId || freshVehicle.tenantId !== current.tenantId || freshVehicle.deletedAt) return;
    if (current.customerId !== customerDocId || current.vehicleId !== paper.vehicleId || current.tenantId !== paper.tenantId) return;
    // Supersede guard: this call may only write the exact state it read. A staged-photo finalize applies
    // only while its own staging is still current; a submit-flow finalize applies only while no edit has
    // staged a replacement and the evidence is untouched. Otherwise an older finalize would overwrite the
    // newer edit's review state or promote the wrong photo - so it writes nothing at all.
    if (pending ? current.pendingEvidencePath !== pending : Boolean(current.pendingEvidencePath) || current.evidencePath !== paper.evidencePath) return;
    promoted = !!pending;
    committed = true;
    const now = new Date().toISOString();
    tx.update(ref, {
      status: decision.status,
      verificationMode: decision.status === "PENDING" ? "review" : "automatic",
      verificationReason: decision.reason,
      extractedPlate: decision.extractedPlate,
      extractedExpiry: decision.extractedExpiry,
      ...(decision.extractedExpiry ? { expiresOn: decision.extractedExpiry } : { expiresOn: null }),
      ...(pending ? { evidencePath: pending, pendingEvidencePath: null, expectedContentMd5: (current as { pendingContentMd5?: string | null }).pendingContentMd5 ?? null, pendingContentMd5: null } : {}),
      // Uploaded vs checked are different claims: a PENDING decision only OBSERVED this
      // version; a VERIFIED/REJECTED decision CHECKED exactly this version. The other field is
      // always cleared so no stale generation from a previous path survives a promotion.
      ...(decision.status === "PENDING"
        ? { uploadedGeneration: observedGeneration, evidenceGeneration: null }
        : { evidenceGeneration: observedGeneration, uploadedGeneration: null }),
      // P4: no standing token URL is ever written; readers use getPrivateFileUrl.
      evidenceUrl: null,
      // A committed finalize (promotion or decision) mutates the record, so it advances the
      // same counter: a customer form opened before this landing now aborts instead of
      // clobbering the finalized state back to PENDING.
      revision: (typeof current.revision === "number" ? current.revision : 0) + 1,
      reviewedBy: decision.status === "PENDING" ? null : "system",
      reviewedAt: decision.status === "PENDING" ? null : now,
      rejectionReason: null,
      updatedAt: now,
    });
    writeAuditLog(tx, { action: "paper.reviewed", entityType: "paper", entityId: paperId, user: { ...user, uid: "system" }, studioId: paper.studioId,
      before: { status: current.status }, after: { status: decision.status, reason: decision.reason, kind: paper.kind, vehicleId: paper.vehicleId, registrationNumber: vehicle.registrationNumber }, metadata: { automatic: true } });
  });
  // Truthful outcome: the precomputed OCR decision is the answer ONLY when this call actually
  // committed it. An abstain (transfer, archive, concurrent edit, already-reviewed) means nothing
  // was written, so report the record's real current state - never an uncommitted VERIFIED.
  if (!committed) {
    // Truthful decision: the transaction wrote NOTHING, so never echo a precomputed
    // outcome. Re-read the record and return its ACTUAL current state - but only to the
    // current owner. The checks may have run across an ownership change; a caller who no
    // longer owns the record gets a generic failure, never the new owner's document state.
    const [latest, vSnap] = await Promise.all([
      ref.get(),
      db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get(),
    ]);
    if (!latest.exists) throw new HttpsError("failed-precondition", "This document was removed while its checks ran.");
    const cur = latest.data() as PaperVerification & { customerId?: string };
    const v = vSnap.data() as Vehicle | undefined;
    if (!vSnap.exists || !v || v.ownerId !== customerDocId || v.tenantId !== cur.tenantId || cur.customerId !== customerDocId) {
      throw new HttpsError("failed-precondition", "This document's checks could not be completed. Open the document to see its current state.");
    }
    return { status: cur.status, reason: "This document changed while its checks ran. Its latest state is shown." };
  }
  // The previous photo is removed only after its confirmed replacement is promoted. Best effort and only
  // ever this paper's own object; a failure leaves a leftover for the dedupe/cleanup sweep, not lost evidence.
  if (promoted && paper.evidencePath && paper.evidencePath !== pending && paper.evidencePath.startsWith(prefix) && !paper.evidencePath.includes("..")) {
    try { await getStorage().bucket().file(paper.evidencePath).delete({ ignoreNotFound: true }); } catch { /* leftover object only */ }
  }
  return { status: decision.status, reason: decision.reason };
});

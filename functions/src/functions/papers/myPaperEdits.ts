import { randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractCustomerUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateMyPaperSchema, deleteMyPaperSchema, normalizeRcReference } from "../../schemas/paper.js";
import { assertNumberUnused, readClaims, numberLockId, rcLockId, PAPER_LOCKS } from "../../lib/paper-numbers.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { resolveCustomerDocId } from "../../lib/customer-identity.js";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const RC_PATTERN = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
type StoredPaper = PaperVerification & { evidencePath?: string | null; pendingEvidencePath?: string | null; submittedBy?: string; revision?: number };

// Load the paper and prove the signed-in customer owns it (customerId, tenant and the car's owner all match).
async function loadOwnedPaper(user: ReturnType<typeof extractCustomerUser>, paperId: string) {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.papers()).doc(paperId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Document not found.");
  const paper = snap.data() as StoredPaper;
  assertTenant(user, paper.tenantId);
  // Records key on the customer DOCUMENT id: a claimed walk-in's doc id differs from the auth uid.
  // Canonical doc id when a profile exists, else the exact base uid keying. Legacy
  // records keyed on the same verified principal's uid remain owned by that principal.
  const customerDocId = (await resolveCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid)) ?? user.uid;
  if (paper.customerId !== customerDocId && paper.customerId !== user.uid) throw new HttpsError("permission-denied", "Not your document.");
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get();
  const vehicle = vehicleSnap.data() as Vehicle | undefined;
  if (!vehicle || (vehicle.ownerId !== customerDocId && vehicle.ownerId !== user.uid) || vehicle.tenantId !== paper.tenantId) throw new HttpsError("permission-denied", "You do not own this vehicle.");
  return { db, ref, paper, customerDocId };
}

// Customer edit: number, expiry, name and photo only. The change goes back to review. Reuses finalizeMyPaper for the photo.
export const updateMyPaper = onCall({ region: "asia-south1", invoker: "public", timeoutSeconds: 60, concurrency: 80, maxInstances: 20, enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(updateMyPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.update");
  const { db, ref, paper, customerDocId } = await loadOwnedPaper(user, data.paperId);
  if (paper.supersededAt) throw new HttpsError("failed-precondition", "This document was replaced.");

  let reference = data.reference ?? paper.reference;
  if (data.reference !== undefined && paper.kind === "RC") {
    reference = normalizeRcReference(data.reference);
    if (!RC_PATTERN.test(reference)) throw new HttpsError("invalid-argument", "RC number must look like GJ01AB1234 (state, RTO, series, number)");
  }
  if (data.removePhoto && data.contentType) throw new HttpsError("invalid-argument", "Choose either a replacement photo or removal, not both.");
  if (paper.kind === "OTHER" && data.title === undefined && !paper.title) {
    // Old OTHER papers have no name; editing one is allowed without forcing a name.
  }
  await assertNumberUnused(db, { tenantId: paper.tenantId, customerId: customerDocId, reference, exceptPaperId: paper.id });

  const now = new Date().toISOString();
  // Every staged replacement gets its own unique path (nonce inside the paper's own prefix, so all
  // paper-<id>. prefix guards still match). Two same-extension edits can never share a staging object,
  // and a stale finalize can never match a newer edit's staging.
  const path = data.contentType ? `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.${randomUUID().slice(0, 8)}.${EXT[data.contentType]}` : null;

  // Mint the upload URL BEFORE any write, exactly like submitMyPaper: if signing fails, nothing has
  // changed - the record keeps pointing at the existing photo and no edit is half-applied.
  let uploadUrl: string | null = null;
  let requiredHeaders: Record<string, string> | null = null;
  if (path && data.contentType) {
    // Create-only + Content-MD5, exactly like the submit mint: the staged URL can only create
    // its object once (never overwrite - even a post-promotion retry of this same URL 412s),
    // and GCS itself rejects bytes that do not match the declared digest. The digest is a
    // byte-corruption/mismatch binding (MD5 is not collision-resistant); the generation pin
    // owns version identity.
    [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 10 * 60 * 1000, contentType: data.contentType, extensionHeaders: { "x-goog-meta-ownerId": customerDocId, "x-goog-if-generation-match": "0", ...(data.contentMd5 ? { "Content-MD5": data.contentMd5 } : {}) } });
    requiredHeaders = { "Content-Type": data.contentType, "x-goog-meta-ownerId": customerDocId, "x-goog-if-generation-match": "0", ...(data.contentMd5 ? { "Content-MD5": data.contentMd5 } : {}) };
  }

  // A replacement photo is STAGED, never swapped in here: evidencePath/evidenceUrl keep pointing at the
  // existing photo until finalizeMyPaper confirms the new object exists. A failed or abandoned upload can
  // no longer strand a genuine document without its evidence, whatever the file types involved.
  const previousPending = paper.pendingEvidencePath ?? null;
  const update: Record<string, unknown> = {
    reference,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.issuedOn !== undefined ? { issuedOn: data.issuedOn } : {}),
    ...(data.expiresOn !== undefined ? { expiresOn: data.expiresOn } : {}),
    status: "PENDING",
    verificationMode: "review",
    verificationReason: path ? "Replacement photo pending; it replaces the current photo after the upload and checks finish. If it stays pending, edit and save again." : "Edited by the owner. Manual review needed.",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    updatedAt: now,
    pendingEvidencePath: path,
    // The declared digest rides with the staged path so finalize can prove the promoted object
    // is exactly the upload this edit approved. No staged path, no pending digest.
    pendingContentMd5: path ? (data.contentMd5 ?? null) : null,
    // Generation identity is bound to the EXACT evidence path. A metadata edit or a staged
    // replacement leaves evidencePath untouched, so the checked generation binding stays valid
    // for those exact bytes - stripping it would un-pin a photo that is still the checked one.
    // The binding only dies with its path: removal clears both fields, and a replacement's
    // finalize stamps the new path's generation while clearing the other field, so a stale
    // checked generation can never survive against a different path (the pinned reader would
    // reject the new good photo - or worse, vouch for bytes it never checked).
    ...(data.removePhoto ? { evidencePath: null, evidenceUrl: null, evidenceGeneration: null, uploadedGeneration: null, expectedContentMd5: null } : {}),
  };
  // Boxed: assigned inside the transaction closure, read after it commits.
  const committed: { evidencePath: string | null } = { evidencePath: null };
  await db.runTransaction(async (tx) => {
    // Re-read inside the transaction so a concurrent edit or replacement cannot slip past the checks above.
    const [freshSnap, freshVehicleSnap] = await Promise.all([tx.get(ref), tx.get(db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId))]);
    const fresh = freshSnap.data() as StoredPaper | undefined;
    if (!fresh || fresh.supersededAt) throw new HttpsError("failed-precondition", "This document was replaced.");
    // Fresh identity re-read inside the transaction: the pre-read in
    // loadOwnedPaper ran before URL signing and object deletion, so a
    // transfer, archive or tenant change landing meanwhile must not let
    // this write through.
    const freshVehicle = freshVehicleSnap.data() as Vehicle | undefined;
    if (!freshVehicleSnap.exists || !freshVehicle || (freshVehicle.ownerId !== customerDocId && freshVehicle.ownerId !== user.uid) || freshVehicle.tenantId !== fresh.tenantId) throw new HttpsError("permission-denied", "You do not own this vehicle.");
    if (freshVehicle.deletedAt) throw new HttpsError("failed-precondition", "This car is archived.");
    if ((fresh.customerId !== customerDocId && fresh.customerId !== user.uid) || fresh.vehicleId !== paper.vehicleId || fresh.tenantId !== paper.tenantId) throw new HttpsError("permission-denied", "Not your document.");
    // Conflict guard: the record must still be exactly the state we pre-read before minting URLs or
    // deleting objects. A concurrent finalize/edit landing in between would otherwise be clobbered by
    // this write, or have its freshly promoted photo deleted as "stillborn" by the cleanup below.
    if ((fresh.evidencePath ?? null) !== (paper.evidencePath ?? null) || (fresh.pendingEvidencePath ?? null) !== (paper.pendingEvidencePath ?? null)) {
      throw new HttpsError("aborted", "This document changed while you were saving. Open it and save again.");
    }
    // Revision guard: the path check above only sees photo changes. Two metadata-only saves from
    // forms opened on the same state would otherwise last-write-wins silently. When the caller
    // names the revision its form was opened on, the save commits only against exactly that
    // revision; a legacy record without the field reads as revision 0.
    const currentRevision = typeof fresh.revision === "number" ? fresh.revision : 0;
    if (data.expectedRevision !== undefined && data.expectedRevision !== currentRevision) {
      throw new HttpsError("aborted", "This document changed while you were saving. Open it and save again.");
    }
    committed.evidencePath = fresh.evidencePath ?? null;
    const claims = await readClaims(tx, db, { tenantId: paper.tenantId, customerId: customerDocId, vehicleId: paper.vehicleId, paperId: paper.id, reference, kind: paper.kind, claimRc: paper.kind === "RC" });
    if (numberLockId(paper.tenantId, customerDocId, fresh.reference) !== numberLockId(paper.tenantId, customerDocId, reference)) {
      const oldRef = db.collection(PAPER_LOCKS).doc(numberLockId(paper.tenantId, customerDocId, fresh.reference));
      const old = await tx.get(oldRef);
      if (old.exists && (old.data() as { paperId: string }).paperId === paper.id) tx.delete(oldRef);
    }
    for (const c of claims) tx.set(c.ref, c.data);
    tx.update(ref, { ...update, revision: currentRevision + 1 });
    writeAuditLog(tx, { action: "paper.updated", entityType: "paper", entityId: paper.id, user, studioId: paper.studioId,
      before: { reference: paper.reference, expiresOn: paper.expiresOn ?? null, status: paper.status },
      after: { reference, expiresOn: data.expiresOn !== undefined ? data.expiresOn : paper.expiresOn ?? null, status: "PENDING" },
      metadata: { by: "customer", kind: paper.kind, vehicleId: paper.vehicleId } });
  });

  // Object deletions happen only AFTER the transaction has proven the owner/state and
  // committed: bytes are removed for exactly the paths the committed record no longer
  // references. Deleting before the proof could destroy a new owner's evidence during a
  // mid-transfer race; deleting after can only leave an unreferenced leftover for the
  // cleanup sweep, never a referenced photo.
  const ownPrefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.`;
  if (data.removePhoto && committed.evidencePath && committed.evidencePath.startsWith(ownPrefix) && !committed.evidencePath.includes("..")) {
    try { await getStorage().bucket().file(committed.evidencePath).delete({ ignoreNotFound: true }); } catch { /* leftover object only */ }
  }
  // A stillborn earlier staging (edit saved but never finalized) leaves its object unreferenced; drop only
  // that paper's own earlier pending object, best effort. The CURRENT evidence object is never touched here:
  // it is replaced only when finalizeMyPaper promotes a confirmed upload.
  if (previousPending && previousPending !== path && previousPending !== committed.evidencePath && previousPending.startsWith(ownPrefix) && !previousPending.includes("..")) {
    try { await getStorage().bucket().file(previousPending).delete({ ignoreNotFound: true }); } catch { /* leftover object only */ }
  }
  return { id: paper.id, uploadUrl, requiredHeaders };
});

// Customer delete: only their own paper record and its photo. Never the car. Rules stay function-only.
// The record and locks go in one transaction that re-proves the owner, the car and the exact
// evidence paths first; the photo bytes are removed only after that commit, for exactly the
// paths the committed record named. A transfer, replacement or concurrent photo change
// mid-flight can no longer delete another owner's evidence or orphan freshly promoted bytes.
export const deleteMyPaper = onCall({ region: "asia-south1", invoker: "public", timeoutSeconds: 60, concurrency: 80, maxInstances: 20, enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(deleteMyPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.update");
  const { db, ref, paper, customerDocId } = await loadOwnedPaper(user, data.paperId);
  const prefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.`;
  const safePath = (p: string | null | undefined): p is string => !!p && p.startsWith(prefix) && !p.includes("..");
  let pathsToDelete: string[] = [];
  await db.runTransaction(async (tx) => {
    const [freshSnap, freshVehicleSnap] = await Promise.all([tx.get(ref), tx.get(db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId))]);
    const fresh = freshSnap.data() as StoredPaper | undefined;
    if (!fresh || fresh.supersededAt) throw new HttpsError("failed-precondition", "This document was replaced.");
    const freshVehicle = freshVehicleSnap.data() as Vehicle | undefined;
    if (!freshVehicleSnap.exists || !freshVehicle || freshVehicle.ownerId !== customerDocId || freshVehicle.tenantId !== fresh.tenantId || freshVehicle.deletedAt) throw new HttpsError("permission-denied", "You do not own this vehicle.");
    if (fresh.customerId !== customerDocId || fresh.vehicleId !== paper.vehicleId || fresh.tenantId !== paper.tenantId) throw new HttpsError("permission-denied", "Not your document.");
    // Exact evidence concurrency: only the paths the record still names may be removed. A
    // concurrent finalize/edit that changed them aborts the delete with nothing touched.
    if ((fresh.evidencePath ?? null) !== (paper.evidencePath ?? null) || (fresh.pendingEvidencePath ?? null) !== (paper.pendingEvidencePath ?? null)) {
      throw new HttpsError("aborted", "This document changed while you were deleting it. Open it and delete again.");
    }
    // Same revision guard as the edit path: a delete from a view opened before a newer edit
    // would otherwise erase that newer state silently. Optional, like the edit guard.
    const currentRevision = typeof fresh.revision === "number" ? fresh.revision : 0;
    if (data.expectedRevision !== undefined && data.expectedRevision !== currentRevision) {
      throw new HttpsError("aborted", "This document changed while you were deleting it. Open it and delete again.");
    }
    pathsToDelete = [...new Set([fresh.evidencePath, fresh.pendingEvidencePath].filter((p): p is string => safePath(p)))];
    const locks = [db.collection(PAPER_LOCKS).doc(numberLockId(paper.tenantId, customerDocId, paper.reference)), ...(paper.kind === "RC" ? [db.collection(PAPER_LOCKS).doc(rcLockId(paper.vehicleId))] : [])];
    const snaps = await Promise.all(locks.map((l) => tx.get(l)));
    tx.delete(ref);
    snaps.forEach((sn, i) => { if (sn.exists && (sn.data() as { paperId: string }).paperId === paper.id) tx.delete(locks[i]!); });
    writeAuditLog(tx, { action: "paper.deleted", entityType: "paper", entityId: paper.id, user, studioId: paper.studioId,
      before: { kind: paper.kind, reference: paper.reference, vehicleId: paper.vehicleId, status: paper.status }, after: null,
      metadata: { by: "customer" } });
  });
  // Bytes go only after the record is gone and the transaction proved what it named. Best
  // effort: an undeletable object is an unreferenced leftover for the cleanup sweep.
  for (const p of pathsToDelete) {
    try { await getStorage().bucket().file(p).delete({ ignoreNotFound: true }); } catch { /* leftover object only */ }
  }
  return { deleted: true };
});

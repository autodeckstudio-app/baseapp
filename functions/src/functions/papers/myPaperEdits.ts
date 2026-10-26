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

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const RC_PATTERN = /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/;
type StoredPaper = PaperVerification & { evidencePath?: string | null; submittedBy?: string };

// Load the paper and prove the signed-in customer owns it (customerId, tenant and the car's owner all match).
async function loadOwnedPaper(user: ReturnType<typeof extractCustomerUser>, paperId: string) {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.papers()).doc(paperId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Document not found.");
  const paper = snap.data() as StoredPaper;
  assertTenant(user, paper.tenantId);
  if (paper.customerId !== user.uid) throw new HttpsError("permission-denied", "Not your document.");
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(paper.vehicleId).get();
  const vehicle = vehicleSnap.data() as Vehicle | undefined;
  if (!vehicle || vehicle.ownerId !== user.uid || vehicle.tenantId !== paper.tenantId) throw new HttpsError("permission-denied", "You do not own this vehicle.");
  return { db, ref, paper };
}

// Customer edit: number, expiry, name and photo only. The change goes back to review. Reuses finalizeMyPaper for the photo.
export const updateMyPaper = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(updateMyPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.update");
  const { db, ref, paper } = await loadOwnedPaper(user, data.paperId);
  if (paper.supersededAt) throw new HttpsError("failed-precondition", "This document was replaced.");

  let reference = data.reference ?? paper.reference;
  if (data.reference !== undefined && paper.kind === "RC") {
    reference = normalizeRcReference(data.reference);
    if (!RC_PATTERN.test(reference)) throw new HttpsError("invalid-argument", "RC number must look like GJ01AB1234 (state, RTO, series, number)");
  }
  if (paper.kind === "OTHER" && data.title === undefined && !paper.title) {
    // Old OTHER papers have no name; editing one is allowed without forcing a name.
  }
  await assertNumberUnused(db, { tenantId: paper.tenantId, customerId: user.uid, reference, exceptPaperId: paper.id });

  const now = new Date().toISOString();
  const path = data.contentType ? `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.${EXT[data.contentType]}` : null;
  const update: Record<string, unknown> = {
    reference,
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.issuedOn !== undefined ? { issuedOn: data.issuedOn } : {}),
    ...(data.expiresOn !== undefined ? { expiresOn: data.expiresOn } : {}),
    status: "PENDING",
    verificationMode: "review",
    verificationReason: path ? "Photo upload is awaiting automatic checks." : "Edited by the owner. Manual review needed.",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    updatedAt: now,
    ...(path ? { evidencePath: path, evidenceUrl: null } : {}),
  };
  await db.runTransaction(async (tx) => {
    // Re-read inside the transaction so a concurrent edit or replacement cannot slip past the checks above.
    const fresh = (await tx.get(ref)).data() as StoredPaper | undefined;
    if (!fresh || fresh.supersededAt) throw new HttpsError("failed-precondition", "This document was replaced.");
    const claims = await readClaims(tx, db, { tenantId: paper.tenantId, customerId: user.uid, vehicleId: paper.vehicleId, paperId: paper.id, reference, kind: paper.kind, claimRc: paper.kind === "RC" });
    if (numberLockId(paper.tenantId, user.uid, fresh.reference) !== numberLockId(paper.tenantId, user.uid, reference)) {
      const oldRef = db.collection(PAPER_LOCKS).doc(numberLockId(paper.tenantId, user.uid, fresh.reference));
      const old = await tx.get(oldRef);
      if (old.exists && (old.data() as { paperId: string }).paperId === paper.id) tx.delete(oldRef);
    }
    for (const c of claims) tx.set(c.ref, c.data);
    tx.update(ref, update);
    writeAuditLog(tx, { action: "paper.updated", entityType: "paper", entityId: paper.id, user, studioId: paper.studioId,
      before: { reference: paper.reference, expiresOn: paper.expiresOn ?? null, status: paper.status },
      after: { reference, expiresOn: data.expiresOn !== undefined ? data.expiresOn : paper.expiresOn ?? null, status: "PENDING" },
      metadata: { by: "customer", kind: paper.kind, vehicleId: paper.vehicleId } });
  });

  // Replacing the photo with another file type leaves the old object under a different name. Remove it, only if it is this paper's own file.
  // Best effort: the record already points at the new path, so a failure here cannot break the edit (the dedupe/cleanup script can sweep leftovers).
  const ownPrefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.`;
  if (path && paper.evidencePath && paper.evidencePath !== path && paper.evidencePath.startsWith(ownPrefix) && !paper.evidencePath.includes("..")) {
    try { await getStorage().bucket().file(paper.evidencePath).delete({ ignoreNotFound: true }); } catch { /* leftover object only */ }
  }
  let uploadUrl: string | null = null;
  let requiredHeaders: Record<string, string> | null = null;
  if (path && data.contentType) {
    [uploadUrl] = await getStorage().bucket().file(path).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 10 * 60 * 1000, contentType: data.contentType, extensionHeaders: { "x-goog-meta-ownerId": user.uid } });
    requiredHeaders = { "Content-Type": data.contentType, "x-goog-meta-ownerId": user.uid };
  }
  return { id: paper.id, uploadUrl, requiredHeaders };
});

// Customer delete: only their own paper record and its photo. Never the car. Rules stay function-only.
export const deleteMyPaper = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractCustomerUser(request);
  assertRole(user, "customer");
  const data = validate(deleteMyPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.update");
  const { db, ref, paper } = await loadOwnedPaper(user, data.paperId);
  const prefix = `${paper.tenantId}/vehicles/${paper.vehicleId}/paper-${paper.id}.`;
  if (paper.evidencePath && paper.evidencePath.startsWith(prefix) && !paper.evidencePath.includes("..")) {
    // Photo first. If Storage fails the record stays, so the customer can retry and nothing is orphaned. A missing object is fine (idempotent).
    try { await getStorage().bucket().file(paper.evidencePath).delete({ ignoreNotFound: true }); }
    catch { throw new HttpsError("unavailable", "Could not remove the photo. Nothing was deleted. Try again."); }
  }
  await db.runTransaction(async (tx) => {
    const locks = [db.collection(PAPER_LOCKS).doc(numberLockId(paper.tenantId, user.uid, paper.reference)), ...(paper.kind === "RC" ? [db.collection(PAPER_LOCKS).doc(rcLockId(paper.vehicleId))] : [])];
    const snaps = await Promise.all(locks.map((l) => tx.get(l)));
    tx.delete(ref);
    snaps.forEach((sn, i) => { if (sn.exists && (sn.data() as { paperId: string }).paperId === paper.id) tx.delete(locks[i]!); });
    writeAuditLog(tx, { action: "paper.deleted", entityType: "paper", entityId: paper.id, user, studioId: paper.studioId,
      before: { kind: paper.kind, reference: paper.reference, vehicleId: paper.vehicleId, status: paper.status }, after: null,
      metadata: { by: "customer" } });
  });
  return { deleted: true };
});

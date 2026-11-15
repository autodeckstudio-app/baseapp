// Admin-only. Covers both declarative-field edits and status transitions
// (including verification). When `status` transitions to 'verified', sets
// verifiedBy/verifiedAt and audits as 'protection.verified'; every other
// change audits as 'protection.updated'. tenantId, vehicleId, customerId,
// and createdAt are never client-writable — not in the schema at all.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Protection } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateProtectionSchema } from "../../schemas/protection.js";

export const updateProtection = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(updateProtectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "protection.update");

  const db = getFirestore();
  const ref = db.collection(SUBCOLLECTIONS.vehicleProtections(data.vehicleId)).doc(data.protectionId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Protection not found.");
    const existing = snap.data() as Protection;
    assertTenant(user, existing.tenantId);

    // Fresh parent authority, re-read INSIDE the transaction: the vehicle
    // must exist, belong to the record's tenant, not be archived, and still
    // be owned by the record's customer. The path vehicleId must match the
    // record's own vehicleId. No silent ownership or parent repair.
    const vehSnap = await tx.get(db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId));
    const veh = vehSnap.data() as { tenantId?: string; ownerId?: string; deletedAt?: unknown } | undefined;
    if (
      !vehSnap.exists || !veh
      || veh.tenantId !== existing.tenantId
      || veh.deletedAt
      || veh.ownerId !== existing.customerId
      || existing.vehicleId !== data.vehicleId
    ) {
      throw new HttpsError("failed-precondition", "This car's current record does not match this protection entry - it cannot be corrected.");
    }

    // History is immutable: a superseded or removed record is evidence of
    // what happened and can never be "corrected" back into something else.
    if ((existing.lifecycle ?? "current") !== "current") {
      throw new HttpsError("failed-precondition", "This protection record is history (superseded or removed) and cannot be corrected.");
    }
    // Fail closed on a stale read: the admin's correction names the revision
    // they reviewed. Anything newer wins; they must refresh and re-declare.
    // Distinguish a REAL revision 0 from a MISSING revision. Real numbers
    // (including 0) take the normal expectedRevision path. A legacy record
    // with NO revision field elects base 0 ONLY with an explicit fingerprint
    // of the reviewed record (its updatedAt): a concurrent unversioned change
    // moves updatedAt and this correction fails closed instead of overwriting
    // blindly. A real 0 is never treated as missing.
    const legacyMissing = existing.revision === undefined || existing.revision === null;
    if (legacyMissing && (!data.legacyBaseUpdatedAt || data.legacyBaseUpdatedAt !== existing.updatedAt)) {
      throw new HttpsError("failed-precondition", "This protection record predates revisions. Review it again so the correction names the exact record you saw.");
    }
    const currentRevision = legacyMissing ? 0 : (existing.revision as number);
    if (data.expectedRevision !== currentRevision) {
      throw new HttpsError("failed-precondition", "This protection record has changed since it was reviewed. Refresh it and correct again.");
    }
    // Scope repair is cosmetic-only: an insurance/FastTag/PUC/RC/warranty
    // record's legal scope is never edited through this path.
    if (data.coverage !== undefined && existing.kind !== "ppf" && existing.kind !== "ceramic") {
      throw new HttpsError("failed-precondition", "Coverage scope can only be corrected on PPF/ceramic records.");
    }

    const now = new Date().toISOString();
    const becomingVerified = data.status === "verified" && existing.status !== "verified";

    // Revision advances on EVERY writer of this record, not only the
    // customer path: an admin correction or verification must invalidate
    // any customer edit still based on the old revision.
    const update: Partial<Protection> = { updatedAt: now, revision: currentRevision + 1 };
    if (data.coverage !== undefined) update.coverage = data.coverage;
    if (data.provider !== undefined) update.provider = data.provider;
    if (data.policyNumber !== undefined) update.policyNumber = data.policyNumber;
    if (data.startDate !== undefined) update.startDate = data.startDate;
    if (data.expiryDate !== undefined) update.expiryDate = data.expiryDate;
    if (data.warrantyYears !== undefined) update.warrantyYears = data.warrantyYears;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.status !== undefined) update.status = data.status;
    if (becomingVerified) {
      update.verifiedBy = user.uid;
      update.verifiedAt = now;
    }

    tx.update(ref, update);
    writeAuditLog(tx, {
      action: becomingVerified ? "protection.verified" : "protection.updated",
      entityType: "Protection",
      entityId: data.protectionId,
      user,
      studioId: null,
      before: { status: existing.status, coverage: existing.coverage ?? null, revision: existing.revision ?? null },
      after: { ...update },
    });
  });

  return { protectionId: data.protectionId };
});

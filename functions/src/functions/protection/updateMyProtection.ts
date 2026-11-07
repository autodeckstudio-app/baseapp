// Customer edit of their own self-declared cosmetic protection. Only records
// with source "customer" that are still unverified are editable: once
// AutoDeck verifies a record it is no longer the customer's to change, and
// AutoDeck-entered records (source absent/"autodeck") were never theirs.
// kind, status, expiryDate and the identity fields are never client-writable.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Protection, Vehicle } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { resolveCustomerDocId } from "../../lib/customer-identity.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateMyProtectionSchema } from "../../schemas/protection.js";

export const updateMyProtection = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");

  const data = validate(updateMyProtectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "protection.update");

  const db = getFirestore();
  // Customer-role boundary preserved exactly. Resolve the canonical doc id when a
  // profile exists; otherwise keep the exact base uid keying. Ownership below accepts
  // either binding of the same verified principal (pre-fix records are uid-keyed).
  const customerDocId = (await resolveCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid)) ?? user.uid;
  const ref = db.collection(SUBCOLLECTIONS.vehicleProtections(data.vehicleId)).doc(data.protectionId);
  const vehicleRef = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);

  await db.runTransaction(async (tx) => {
    // Fresh reads inside the transaction: the record's stored customerId is
    // not proof of current ownership (the car may have been transferred,
    // archived or moved tenant since the declaration).
    const [vehicleSnap, snap] = await Promise.all([tx.get(vehicleRef), tx.get(ref)]);
    if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
    const vehicle = vehicleSnap.data() as Vehicle;
    assertTenant(user, vehicle.tenantId);
    if (vehicle.ownerId !== customerDocId && vehicle.ownerId !== user.uid) throw new HttpsError("permission-denied", "Not your car.");
    if (vehicle.deletedAt) throw new HttpsError("failed-precondition", "This car is archived.");
    if (!snap.exists) throw new HttpsError("not-found", "Protection not found.");
    const existing = snap.data() as Protection;
    assertTenant(user, existing.tenantId);
    if (existing.customerId !== customerDocId && existing.customerId !== user.uid) throw new HttpsError("permission-denied", "Not your record.");
    if (existing.source !== "customer") throw new HttpsError("permission-denied", "Only details you added can be edited here.");
    if (existing.kind !== "ppf" && existing.kind !== "ceramic") throw new HttpsError("permission-denied", "Only cosmetic protection details can be edited here.");
    if (existing.status !== "unverified") throw new HttpsError("failed-precondition", "This record can no longer be edited.");
    // Only a CURRENT record is editable: superseded/removed records are
    // history, not drafts.
    if ((existing.lifecycle ?? "current") !== "current") throw new HttpsError("failed-precondition", "This record is no longer current and cannot be edited.");
    // Identity binding: stored identity that disagrees with the request
    // path is a corrupt binding - fail closed. Legacy records may predate
    // the stored id/vehicleId fields; the repair write below normalizes
    // them explicitly.
    if (existing.id !== undefined && existing.id !== ref.id) throw new HttpsError("failed-precondition", "Record identity does not match this car.");
    if (existing.vehicleId !== undefined && existing.vehicleId !== data.vehicleId) throw new HttpsError("failed-precondition", "Record identity does not match this car.");
    // Monotonic-revision precondition: the edit must name the revision it
    // was based on. A lost-ack retry after its own write landed also
    // mismatches here - truthful, because the record genuinely changed; the
    // client re-reads (its listener already has the new version). A legacy
    // record without a revision requires the explicit null election: the
    // client may only send null after re-reading and confirming the latest
    // details, and the write then stamps revision 1 (the repair).
    if (existing.revision === null || existing.revision === undefined) {
      if (data.expectedRevision !== null) throw new HttpsError("failed-precondition", "This record predates versioning. Reload it and confirm the latest details before editing.");
      // Freshness proof for the repair election: the fingerprint must be
      // the updatedAt of the legacy record the client actually edited
      // from. Any change since that copy fails closed - the repair never
      // normalizes over unseen changes.
      if (data.legacyBaseUpdatedAt !== existing.updatedAt) {
        throw new HttpsError("failed-precondition", "These details changed since you loaded them. Reload the latest version and confirm it before editing.");
      }
    } else if (data.expectedRevision !== existing.revision) {
      throw new HttpsError("failed-precondition", "These details changed since you loaded them. Review the latest version and try again.");
    }

    const now = new Date().toISOString();
    const update: Partial<Protection> = { updatedAt: now, revision: (existing.revision === null || existing.revision === undefined) ? 1 : existing.revision + 1 };
    // The legacy repair election is also the explicit normalization: stamp
    // the identity fields the legacy record predates, alongside revision 1.
    if (existing.id === undefined) update.id = ref.id;
    if (existing.vehicleId === undefined) update.vehicleId = data.vehicleId;
    if (data.provider !== undefined) update.provider = data.provider;
    if (data.warrantyYears !== undefined) update.warrantyYears = data.warrantyYears;
    if (data.startDate !== undefined) update.startDate = data.startDate;
    if (data.notes !== undefined) update.notes = data.notes;

    tx.update(ref, update);
    writeAuditLog(tx, {
      action: "protection.updated",
      entityType: "Protection",
      entityId: data.protectionId,
      user,
      studioId: null,
      before: { provider: existing.provider, warrantyYears: existing.warrantyYears ?? null, startDate: existing.startDate, revision: existing.revision ?? null },
      after: { ...update },
    });
  });

  return { protectionId: data.protectionId };
});
// The new version is stamped inside the transaction; clients re-read via
// their listener rather than trusting a returned copy.

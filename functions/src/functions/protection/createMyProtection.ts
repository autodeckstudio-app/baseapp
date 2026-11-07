// Customer self-declare for cosmetic protections (PPF / ceramic coating).
// The legal/financial kinds stay AutoDeck-entered via admin-only
// createProtection. Every record here is source "customer" and status
// "unverified": it is "Added by you" information for the customer and the
// studio, never AutoDeck-verified work. No expiryDate is accepted or derived
// — warranty years alone do not create an expiry without a coverage start.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { shouldEnforceAppCheck } from "../../lib/environment.js";
import { getFirestore } from "firebase-admin/firestore";
import type { Protection, Vehicle } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createMyProtectionSchema } from "../../schemas/protection.js";
import { requireCustomerDocId } from "../../lib/customer-identity.js";

export const createMyProtection = onCall({ region: "asia-south1", enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "customer");

  const data = validate(createMyProtectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "protection.create");

  const db = getFirestore();
  // Records key on the customer DOCUMENT id: a claimed walk-in's doc id differs from the auth uid.
  const customerDocId = await requireCustomerDocId(db, COLLECTIONS.customers(), user.claims.tenantId, user.uid);
  const vehicleRef = db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId);
  // Deterministic id from the client-supplied declaration identity: a retry
  // after a lost response finds the same record and returns it unchanged.
  const ref = db.collection(SUBCOLLECTIONS.vehicleProtections(data.vehicleId)).doc(data.declarationId);

  const protection = await db.runTransaction(async (tx) => {
    // Every check is fresh inside the transaction: ownership, tenant and
    // archive state can change between the request and the write.
    const [vehicleSnap, existingSnap] = await Promise.all([tx.get(vehicleRef), tx.get(ref)]);
    if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
    const vehicle = vehicleSnap.data() as Vehicle;
    assertTenant(user, vehicle.tenantId);
    if (vehicle.ownerId !== customerDocId) throw new HttpsError("permission-denied", "Not your car.");
    if (vehicle.deletedAt) throw new HttpsError("failed-precondition", "This car is archived.");
    if (existingSnap.exists) {
      const existing = existingSnap.data() as Protection;
      // Idempotent replay only when it is the same declaration, same caller,
      // same PAYLOAD. Same op id with different details is a conflict, not a
      // silent return of the old fields.
      // Exact identity first: a replay must return THIS vehicle's record in
      // THIS tenant under THIS id - never a look-alike.
      const sameIdentity =
        existing.id === ref.id && existing.vehicleId === data.vehicleId && existing.tenantId === vehicle.tenantId;
      const samePayload =
        existing.kind === data.kind &&
        (existing.provider ?? null) === (data.provider ?? null) &&
        (existing.startDate ?? null) === (data.startDate ?? null) &&
        (existing.warrantyYears ?? null) === (data.warrantyYears ?? null) &&
        (existing.notes ?? null) === (data.notes ?? null);
      if (existing.source === "customer" && existing.customerId === customerDocId && sameIdentity && samePayload) {
        return existing;
      }
      if (existing.source === "customer" && existing.customerId === customerDocId) {
        throw new HttpsError("already-exists", "This declarationId was already used with different details.");
      }
      throw new HttpsError("already-exists", "This declarationId is already used.");
    }

    const now = new Date().toISOString();
    const created: Protection = {
      id: ref.id,
      tenantId: vehicle.tenantId,
      vehicleId: data.vehicleId,
      customerId: customerDocId,
      kind: data.kind,
      provider: data.provider ?? null,
      policyNumber: null,
      startDate: data.startDate ?? null,
      expiryDate: null,
      warrantyYears: data.warrantyYears ?? null,
      documentUrl: null,
      status: "unverified",
      source: "customer",
      verifiedBy: null,
      verifiedAt: null,
      notes: data.notes ?? null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(ref, created);
    writeAuditLog(tx, {
      action: "protection.created",
      entityType: "Protection",
      entityId: ref.id,
      user,
      studioId: null,
      after: { vehicleId: data.vehicleId, kind: data.kind, status: "unverified", source: "customer" },
    });
    return created;
  });

  return { protection };
});

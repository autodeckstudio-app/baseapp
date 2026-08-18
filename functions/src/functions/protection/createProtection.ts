// Admin-only. Protections are never customer-declared in this build (Phase
// 2D explicit security decision — deviates from doc06's Ownership Matrix,
// which had customers declare via Cloud Function; see Phase 2D HANDOFF).
// Always created in 'unverified' status; verification is a separate,
// explicitly audited step via updateProtection.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Protection, Vehicle } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { createProtectionSchema } from "../../schemas/protection.js";

export const createProtection = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");

  const data = validate(createProtectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "protection.create");

  const db = getFirestore();
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get();
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
  const vehicle = vehicleSnap.data() as Vehicle;
  assertTenant(user, vehicle.tenantId);

  const now = new Date().toISOString();
  const ref = db.collection(SUBCOLLECTIONS.vehicleProtections(data.vehicleId)).doc();

  const protection: Protection = {
    id: ref.id,
    tenantId: vehicle.tenantId,
    vehicleId: data.vehicleId,
    customerId: vehicle.ownerId,
    kind: data.kind,
    provider: data.provider ?? null,
    policyNumber: data.policyNumber ?? null,
    startDate: data.startDate ?? null,
    expiryDate: data.expiryDate ?? null,
    documentUrl: null,
    status: "unverified",
    verifiedBy: null,
    verifiedAt: null,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, protection);
    writeAuditLog(tx, {
      action: "protection.created",
      entityType: "Protection",
      entityId: ref.id,
      user,
      studioId: null,
      after: { vehicleId: data.vehicleId, kind: data.kind, status: "unverified" },
    });
  });

  return { protection };
});

// Admin-only. Covers both declarative-field edits and status transitions
// (including verification). When `status` transitions to 'verified', sets
// verifiedBy/verifiedAt and audits as 'protection.verified'; every other
// change audits as 'protection.updated'. tenantId, vehicleId, customerId,
// and createdAt are never client-writable — not in the schema at all.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Protection } from "@autodeck/core";
import { SUBCOLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertTenant } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateProtectionSchema } from "../../schemas/protection.js";

export const updateProtection = onCall({ region: "asia-south1" }, async (request) => {
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

    const now = new Date().toISOString();
    const becomingVerified = data.status === "verified" && existing.status !== "verified";

    const update: Partial<Protection> = { updatedAt: now };
    if (data.provider !== undefined) update.provider = data.provider;
    if (data.policyNumber !== undefined) update.policyNumber = data.policyNumber;
    if (data.startDate !== undefined) update.startDate = data.startDate;
    if (data.expiryDate !== undefined) update.expiryDate = data.expiryDate;
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
      before: { status: existing.status },
      after: { ...update },
    });
  });

  return { protectionId: data.protectionId };
});

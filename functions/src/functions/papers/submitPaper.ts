import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { submitPaperSchema } from "../../schemas/paper.js";

// Studio-and-above: register a customer vehicle document for verification.
// The vehicle is loaded server-side to derive the owner (customerId) — the
// client never supplies it.
export const submitPaper = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(submitPaperSchema, request.data);
  assertStudio(user, data.studioId, "Paper");
  await enforceRateLimit(subjectFrom(user), "paper.submit");

  const db = getFirestore();
  const vehicleSnap = await db.collection(COLLECTIONS.vehicles()).doc(data.vehicleId).get();
  if (!vehicleSnap.exists) throw new HttpsError("not-found", "Vehicle not found.");
  const vehicle = vehicleSnap.data() as Vehicle;
  if (user.claims.role !== "superadmin" && vehicle.tenantId !== user.claims.tenantId) {
    throw new HttpsError("permission-denied", "Vehicle belongs to a different tenant.");
  }

  const ref = db.collection(COLLECTIONS.papers()).doc();
  const now = new Date().toISOString();

  const paper: PaperVerification = {
    id: ref.id,
    tenantId: vehicle.tenantId,
    studioId: data.studioId,
    vehicleId: data.vehicleId,
    customerId: vehicle.ownerId,
    kind: data.kind,
    reference: data.reference,
    issuedOn: data.issuedOn ?? null,
    expiresOn: data.expiresOn ?? null,
    evidenceUrl: data.evidenceUrl ?? null,
    status: "PENDING",
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    notes: data.notes ?? null,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, paper);
    writeAuditLog(tx, {
      action: "paper.submitted",
      entityType: "paper",
      entityId: ref.id,
      user,
      studioId: data.studioId,
      after: { kind: paper.kind, reference: paper.reference, vehicleId: paper.vehicleId },
    });
  });

  return { id: ref.id };
});

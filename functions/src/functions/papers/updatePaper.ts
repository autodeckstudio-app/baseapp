import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updatePaperSchema, normalizeRcReference } from "../../schemas/paper.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

// Studio-and-above: correct document details (e.g. a renewed insurance expiry).
// Corrections on a REVIEWED paper send it back to PENDING for re-review.
export const updatePaper = onCall({ region: "asia-south1", timeoutSeconds: 60, concurrency: 80, maxInstances: 20, enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(updatePaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.update");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.papers()).doc(data.paperId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Paper not found.");
    const before = snap.data() as PaperVerification & { revision?: number };
    if (user.claims.role !== "superadmin" && before.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Paper belongs to a different tenant.");
    }
    assertStudio(user, before.studioId, "Paper");

    const vehicleSnap = await tx.get(db.collection(COLLECTIONS.vehicles()).doc(before.vehicleId));
    const vehicle = vehicleSnap.data() as Vehicle | undefined;
    if (!vehicleSnap.exists || !vehicle || vehicle.deletedAt || vehicle.tenantId !== before.tenantId || vehicle.ownerId !== before.customerId) throw new HttpsError("failed-precondition", "The document is not linked to its current active car owner.");
    if (before.kind === "RC" && (!vehicle.registrationNumber || normalizeRcReference(data.reference ?? before.reference) !== normalizeRcReference(vehicle.registrationNumber))) throw new HttpsError("failed-precondition", "The RC number does not match this car. Check the plate before saving.");

    // Same mutation counter as customer edits; see reviewPaper.
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString(), revision: (typeof before.revision === "number" ? before.revision : 0) + 1 };
    for (const key of ["reference", "issuedOn", "expiresOn", "evidenceUrl", "notes"] as const) {
      if (data[key] !== undefined) patch[key] = key === "reference" && before.kind === "RC" ? normalizeRcReference(data.reference!) : data[key];
    }
    if (before.status !== "PENDING") {
      patch.status = "PENDING";
      patch.inspectedPlate = null;
      patch.originalInspected = null;
      patch.reviewedBy = null;
      patch.reviewedAt = null;
      patch.rejectionReason = null;
      patch.verificationMode = "review";
      patch.verificationReason = "Document details changed. Review the original again.";
    }
    tx.update(ref, patch);
    writeAuditLog(tx, {
      action: "paper.updated",
      entityType: "paper",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: { reference: before.reference, expiresOn: before.expiresOn, status: before.status },
      after: patch,
    });
  });

  return { id: data.paperId };
});

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { PaperVerification, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { reviewPaperSchema, normalizeRcReference } from "../../schemas/paper.js";
import { shouldEnforceAppCheck } from "../../lib/environment.js";

// Studio-and-above: verify or reject a pending paper. Rejection requires a
// reason the office can relay to the customer.
export const reviewPaper = onCall({ region: "asia-south1", timeoutSeconds: 60, concurrency: 80, maxInstances: 20, enforceAppCheck: shouldEnforceAppCheck() }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(reviewPaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.review");
  if (data.decision === "REJECTED" && !data.rejectionReason) {
    throw new HttpsError("invalid-argument", "rejectionReason is required when rejecting.");
  }

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
    if (before.status !== "PENDING") {
      throw new HttpsError("failed-precondition", `Paper is already ${before.status}.`);
    }

    if (data.decision === "VERIFIED") {
      const vehicleSnap = await tx.get(db.collection(COLLECTIONS.vehicles()).doc(before.vehicleId));
      const vehicle = vehicleSnap.data() as Vehicle | undefined;
      if (!vehicleSnap.exists || !vehicle || vehicle.deletedAt || vehicle.tenantId !== before.tenantId || vehicle.ownerId !== before.customerId) {
        throw new HttpsError("failed-precondition", "This document is not linked to its current active car owner. Review the car first.");
      }
      if (data.originalInspected !== true || !data.inspectedPlate) throw new HttpsError("invalid-argument", "Read the original document, enter the plate printed on it and confirm inspection before verifying.");
      if (!vehicle.registrationNumber || normalizeRcReference(data.inspectedPlate) !== normalizeRcReference(vehicle.registrationNumber)) throw new HttpsError("failed-precondition", "The inspected document plate does not match this car. Request corrected evidence.");
      const observedPlate = (before as PaperVerification & { extractedPlate?: string | null }).extractedPlate;
      if ((before.kind === "RC" && normalizeRcReference(before.reference) !== normalizeRcReference(vehicle.registrationNumber ?? "")) ||
          (observedPlate && normalizeRcReference(observedPlate) !== normalizeRcReference(vehicle.registrationNumber ?? ""))) {
        throw new HttpsError("failed-precondition", "The document plate does not match this car. Request corrected evidence before verifying.");
      }
    }
    const now = new Date().toISOString();
    tx.update(ref, {
      status: data.decision,
      reviewedBy: user.uid,
      reviewedAt: now,
      rejectionReason: data.decision === "REJECTED" ? data.rejectionReason ?? "" : null,
      verificationMode: "manual",
      verificationReason: data.decision === "REJECTED" ? data.rejectionReason ?? "" : "Original document verified by staff.",
      inspectedPlate: data.decision === "VERIFIED" ? normalizeRcReference(data.inspectedPlate!) : null,
      originalInspected: data.decision === "VERIFIED" ? true : null,
      updatedAt: now,
      // Same mutation counter as customer edits: a staff decision invalidates any
      // customer form opened on the older state, so a stale save/delete aborts.
      revision: (typeof before.revision === "number" ? before.revision : 0) + 1,
    });
    writeAuditLog(tx, {
      action: "paper.reviewed",
      entityType: "paper",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: { status: before.status },
      after: { status: data.decision, inspectedPlate: data.decision === "VERIFIED" ? normalizeRcReference(data.inspectedPlate!) : null, originalInspected: data.decision === "VERIFIED", rejectionReason: data.rejectionReason ?? null, kind: before.kind, reference: before.reference, vehicleId: before.vehicleId },
    });
  });

  return { id: data.paperId, status: data.decision };
});

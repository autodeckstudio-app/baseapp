import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { PaperVerification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updatePaperSchema } from "../../schemas/paper.js";

// Studio-and-above: correct document details (e.g. a renewed insurance expiry).
// Corrections on a REVIEWED paper send it back to PENDING for re-review.
export const updatePaper = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(updatePaperSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "paper.update");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.papers()).doc(data.paperId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Paper not found.");
    const before = snap.data() as PaperVerification;
    if (user.claims.role !== "superadmin" && before.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Paper belongs to a different tenant.");
    }
    assertStudio(user, before.studioId, "Paper");

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of ["reference", "issuedOn", "expiresOn", "evidenceUrl", "notes"] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    if (before.status !== "PENDING") {
      patch.status = "PENDING";
      patch.reviewedBy = null;
      patch.reviewedAt = null;
      patch.rejectionReason = null;
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

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { PaperVerification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { reviewPaperSchema } from "../../schemas/paper.js";
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

    const now = new Date().toISOString();
    tx.update(ref, {
      status: data.decision,
      reviewedBy: user.uid,
      reviewedAt: now,
      rejectionReason: data.decision === "REJECTED" ? data.rejectionReason ?? "" : null,
      verificationMode: "manual",
      verificationReason: data.decision === "REJECTED" ? data.rejectionReason ?? "" : "Original document verified by staff.",
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
      after: { status: data.decision, rejectionReason: data.rejectionReason ?? null, kind: before.kind, reference: before.reference, vehicleId: before.vehicleId },
    });
  });

  return { id: data.paperId, status: data.decision };
});

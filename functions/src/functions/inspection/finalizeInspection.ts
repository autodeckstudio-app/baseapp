// Studio/admin only. Locks an inspection: no further checklist/notes edits
// are possible afterward (enforced by updateInspection.ts's status check).
// Idempotent — finalizing an already-finalized inspection returns its
// existing state rather than erroring (matches confirmManualPayment's
// established idempotent-duplicate-confirmation pattern).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Inspection } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { finalizeInspectionSchema } from "../../schemas/inspection.js";

export const finalizeInspection = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(finalizeInspectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inspection.finalize");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.inspections()).doc(data.jobId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Inspection not found.");
    const inspection = snap.data() as Inspection;

    if (inspection.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Cross-tenant access denied.");
    }
    if (user.claims.role === "studio" && user.claims.studioId !== inspection.studioId) {
      throw new HttpsError("permission-denied", "Inspection belongs to a different studio.");
    }
    if (inspection.status === "finalized") {
      return { jobId: data.jobId, alreadyFinalized: true };
    }

    const now = new Date().toISOString();
    tx.update(ref, { status: "finalized", finalizedAt: now, finalizedBy: user.uid, updatedAt: now });
    writeAuditLog(tx, {
      action: "inspection.finalized",
      entityType: "Inspection",
      entityId: data.jobId,
      user,
      studioId: inspection.studioId,
      before: { status: "in_progress" },
      after: { status: "finalized" },
    });

    return { jobId: data.jobId, alreadyFinalized: false };
  });

  return result;
});

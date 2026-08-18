// Studio/admin only. Records checklist findings and/or overall notes on an
// IN-PROGRESS inspection. Rejects outright once finalized — finalized
// inspections are immutable (see finalizeInspection.ts); there is no
// correction/reopen path in this build.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { Inspection, InspectionChecklistItem } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateInspectionSchema } from "../../schemas/inspection.js";

export const updateInspection = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(updateInspectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inspection.update");

  if (!data.items && data.overallNotes === undefined) {
    throw new HttpsError("invalid-argument", "Nothing to update.");
  }

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.inspections()).doc(data.jobId);

  await db.runTransaction(async (tx) => {
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
      throw new HttpsError("failed-precondition", "This inspection has already been finalized and cannot be edited.");
    }

    let checklist = inspection.checklist;
    if (data.items) {
      const updates = new Map(data.items.map((i) => [i.key, i]));
      const unknownKeys = data.items.filter((i) => !inspection.checklist.some((c) => c.key === i.key));
      if (unknownKeys.length > 0) {
        throw new HttpsError("invalid-argument", `Unknown checklist item(s): ${unknownKeys.map((i) => i.key).join(", ")}`);
      }
      checklist = inspection.checklist.map((item): InspectionChecklistItem => {
        const update = updates.get(item.key);
        if (!update) return item;
        return {
          ...item,
          rating: update.rating !== undefined ? update.rating : item.rating,
          notes: update.notes !== undefined ? update.notes : item.notes,
        };
      });
    }

    const now = new Date().toISOString();
    const overallNotes = data.overallNotes !== undefined ? data.overallNotes : inspection.overallNotes;

    tx.update(ref, { checklist, overallNotes, updatedAt: now });
    writeAuditLog(tx, {
      action: "inspection.updated",
      entityType: "Inspection",
      entityId: data.jobId,
      user,
      studioId: inspection.studioId,
      after: { updatedItemKeys: data.items?.map((i) => i.key) ?? [], overallNotesChanged: data.overallNotes !== undefined },
    });
  });

  return { jobId: data.jobId };
});

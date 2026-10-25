// Studio/admin only. Records checklist findings and/or overall notes on an
// IN-PROGRESS inspection. Rejects outright once finalized — finalized
// inspections are immutable (see finalizeInspection.ts); there is no
// correction/reopen path in this build.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Inspection, InspectionChecklistItem } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateInspectionSchema } from "../../schemas/inspection.js";

// Same allowlist as issueInspectionPhotoUploadUrl.
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Generous technical ceiling, not a business policy: phone-camera photos are
// typically well under 5 MB. Adjust here if larger evidence photos are needed.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const updateInspection = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);

  if (!["studio", "admin", "superadmin"].includes(user.claims.role)) {
    throw new HttpsError("permission-denied", "Studio or admin role required.");
  }

  const data = validate(updateInspectionSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "inspection.update");

  if (!data.items && data.overallNotes === undefined && !data.addPhotos) {
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

    // Photo paths: only objects issued by issueInspectionPhotoUploadUrl for
    // THIS job are accepted (exact tenant+job prefix), appended and deduped.
    // Anything else is refused, so a client cannot pin another job's or
    // another tenant's object onto this inspection. The prefix alone proves
    // nothing, though: every newly attached path is verified against the
    // actual object - it must exist, carry the customerId binding stamped at
    // issue time (which is what storage.rules uses to scope the customer's
    // read), be an allowed image type, and be under the size ceiling.
    let photos = inspection.photos;
    if (data.addPhotos) {
      const prefix = `${inspection.tenantId}/jobs/${inspection.jobId}/photos/`;
      const bad = data.addPhotos.filter((p) => !p.startsWith(prefix));
      if (bad.length > 0) {
        throw new HttpsError("invalid-argument", "Photo paths must come from an upload URL issued for this job.");
      }
      const newPaths = data.addPhotos.filter((p) => !inspection.photos.includes(p));
      const bucket = getStorage().bucket();
      await Promise.all(
        newPaths.map(async (p) => {
          const [meta] = await bucket
            .file(p)
            .getMetadata()
            .catch(() => {
              throw new HttpsError("not-found", "Photo was not uploaded - PUT the bytes to the issued URL before attaching it.");
            });
          if (meta.metadata?.["customerId"] !== inspection.customerId) {
            throw new HttpsError("failed-precondition", "Photo is not bound to this inspection's customer.");
          }
          if (!ALLOWED_PHOTO_TYPES.has(meta.contentType ?? "")) {
            throw new HttpsError("failed-precondition", "Photo is not an allowed image type (jpeg/png/webp).");
          }
          if (Number(meta.size ?? 0) > MAX_PHOTO_BYTES) {
            throw new HttpsError("failed-precondition", "Photo exceeds the 10 MB size limit.");
          }
        }),
      );
      const merged = [...new Set([...inspection.photos, ...data.addPhotos])];
      // Reject rather than silently drop: a truncated evidence set must never
      // look like a complete one.
      if (merged.length > 20) {
        throw new HttpsError("failed-precondition", "An inspection can hold at most 20 photos.");
      }
      photos = merged;
    }

    tx.update(ref, { checklist, overallNotes, photos, updatedAt: now });
    writeAuditLog(tx, {
      action: "inspection.updated",
      entityType: "Inspection",
      entityId: data.jobId,
      user,
      studioId: inspection.studioId,
      after: {
        updatedItemKeys: data.items?.map((i) => i.key) ?? [],
        overallNotesChanged: data.overallNotes !== undefined,
        addedPhotos: data.addPhotos?.length ?? 0,
      },
    });
  });

  return { jobId: data.jobId };
});

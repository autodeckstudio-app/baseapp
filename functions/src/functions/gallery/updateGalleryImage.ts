import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { GalleryImage } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { updateGalleryImageSchema } from "../../schemas/gallery.js";

// Admin-only: edit caption/category/order or unpublish (active: false).
export const updateGalleryImage = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(updateGalleryImageSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.update");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.gallery()).doc(data.imageId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Gallery image not found.");
    const before = snap.data() as GalleryImage;
    if (user.claims.role !== "superadmin" && before.tenantId !== user.claims.tenantId) {
      throw new HttpsError("permission-denied", "Image belongs to a different tenant.");
    }
    assertStudio(user, before.studioId, "Gallery image");

    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const key of ["caption", "category", "vehicleLabel", "displayOrder", "active"] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }
    tx.update(ref, patch);
    writeAuditLog(tx, {
      action: "gallery.imageUpdated",
      entityType: "gallery",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: { caption: before.caption, active: before.active },
      after: patch,
    });
  });

  return { id: data.imageId };
});

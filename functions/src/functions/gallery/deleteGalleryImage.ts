import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { GalleryImage } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { deleteGalleryImageSchema } from "../../schemas/gallery.js";

// Admin-only: permanently remove a gallery image. Audited with the URL so a
// mistaken delete can be re-added from the audit record.
export const deleteGalleryImage = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(deleteGalleryImageSchema, request.data);
  await enforceRateLimit(subjectFrom(user), "gallery.delete");

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

    tx.delete(ref);
    writeAuditLog(tx, {
      action: "gallery.imageDeleted",
      entityType: "gallery",
      entityId: ref.id,
      user,
      studioId: before.studioId,
      before: { imageUrl: before.imageUrl, category: before.category, caption: before.caption },
    });
  });

  return { id: data.imageId, deleted: true };
});

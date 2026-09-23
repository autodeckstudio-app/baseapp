import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { GalleryImage } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAuditLog } from "../../middleware/audit.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { addGalleryImageSchema } from "../../schemas/gallery.js";

// Admin-only: publish an image to the studio's public gallery.
export const addGalleryImage = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "admin", "superadmin");
  const data = validate(addGalleryImageSchema, request.data);
  assertStudio(user, data.studioId, "Gallery image");
  await enforceRateLimit(subjectFrom(user), "gallery.create");

  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.gallery()).doc();
  const now = new Date().toISOString();

  const image: GalleryImage = {
    id: ref.id,
    tenantId: user.claims.tenantId,
    studioId: data.studioId,
    imageUrl: data.imageUrl,
    caption: data.caption ?? null,
    category: data.category,
    vehicleLabel: data.vehicleLabel ?? null,
    active: true,
    displayOrder: data.displayOrder ?? 0,
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(ref, image);
    writeAuditLog(tx, {
      action: "gallery.imageAdded",
      entityType: "gallery",
      entityId: ref.id,
      user,
      studioId: data.studioId,
      after: { imageUrl: image.imageUrl, category: image.category },
    });
  });

  return { id: ref.id };
});

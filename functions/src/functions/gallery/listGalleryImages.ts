import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import type { GalleryImage } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { extractUser, assertRole, assertStudio } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { enforceRateLimit, subjectFrom } from "../../middleware/rateLimit.js";
import { listGalleryImagesSchema } from "../../schemas/gallery.js";

// Studio-and-above read: management list including unpublished images.
// The public marketing gallery reads Firestore directly (rules: public read
// of active images) — this callable is for the admin management screen.
export const listGalleryImages = onCall({ region: "asia-south1" }, async (request) => {
  const user = extractUser(request);
  assertRole(user, "studio", "admin", "superadmin");
  const data = validate(listGalleryImagesSchema, request.data);
  assertStudio(user, data.studioId, "Gallery image");
  await enforceRateLimit(subjectFrom(user), "gallery.read");

  const db = getFirestore();
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.gallery())
    .where("tenantId", "==", user.claims.tenantId)
    .where("studioId", "==", data.studioId);
  if (data.includeInactive !== true) query = query.where("active", "==", true);
  query = query.orderBy("displayOrder", "asc").limit(500);

  const snap = await query.get();
  return { images: snap.docs.map((d) => d.data() as GalleryImage) };
});

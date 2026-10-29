// Anonymous public cover photo for a reviewed car listing. Visitors never reach the originals
// bucket: this handler re-checks the live listing, the review record and the exact reviewed
// object generation on EVERY request and streams ONLY that pinned generation's bytes.
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FIRST_TENANT_ID, type CarListing } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { canServePublicPhoto, PUBLIC_LISTING_PHOTOS, type PublicListingPhotoReview } from "../../lib/public-listing.js";
import { enforceRateLimit } from "../../middleware/rateLimit.js";

// Anonymous GET: streams the reviewed photo while every gate holds, else 404. no-store always.
export const publicListingPhoto = onRequest({ region: "asia-south1", invoker: "public" }, async (req, res) => {
  const deny = (): void => { res.status(404).setHeader("Cache-Control", "no-store").send("Not found"); };
  try {
    if (req.method !== "GET") { deny(); return; }
    const listingId = typeof req.query.listingId === "string" ? req.query.listingId : "";
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(listingId)) { deny(); return; }
    const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "anon").split(",")[0]?.trim() ?? "anon";
    await enforceRateLimit({ uid: `ip:${ip}`, tenantId: "public", role: null }, "gallery.read");
    const db = getFirestore();
    const [lsnap, rsnap] = await Promise.all([
      db.collection(COLLECTIONS.carListings()).doc(listingId).get(),
      db.collection(PUBLIC_LISTING_PHOTOS).doc(listingId).get(),
    ]);
    if (!lsnap.exists || !rsnap.exists) { deny(); return; }
    const listing = lsnap.data() as CarListing;
    if (listing.tenantId !== FIRST_TENANT_ID) { deny(); return; }
    const review = rsnap.data() as PublicListingPhotoReview;
    if (!canServePublicPhoto(listing, review, Date.now())) { deny(); return; }
    const bucket = getStorage().bucket();
    const [meta] = await bucket.file(review.sourcePath).getMetadata();
    if (String(meta.generation) !== review.sourceGeneration) { deny(); return; }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", review.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Read is bound to the reviewed generation, so a post-check replacement can never be served:
    // without object versioning the old generation is gone, and this download fails closed.
    const [bytes] = await bucket.file(review.sourcePath, { generation: review.sourceGeneration }).download();
    res.end(bytes);
  } catch {
    deny();
  }
});

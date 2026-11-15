import type { CarListing } from "@autodeck/core";

/** The only fields an anonymous visitor ever gets for a car. An explicit allowlist: new listing fields stay private until added here.
 *  No price, owner count, description, insurance date, seller, plate, area or photos (photo files are not plate-redacted, so none are sent). */
export const PUBLIC_LISTING_FIELDS = ["id", "status", "make", "model", "variant", "year", "kmDriven", "fuel", "gearbox", "bodyType", "colour", "createdAt"] as const;

export function publicListingView(l: CarListing): Record<string, unknown> {
  const src = l as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_LISTING_FIELDS) out[k] = k === "bodyType" ? (l.bodyType ?? null) : src[k];
  out.photoUrls = [];
  out.priceHidden = true;
  out.mine = false;
  return out;
}

/** One admin-reviewed cover photo per listing, served revocably through publicListingPhoto (never a public storage object). */
export const PUBLIC_LISTING_PHOTOS = "publicListingPhotos";

export type PublicListingPhotoReview = {
  tenantId: string;
  sourcePath: string;
  sourceGeneration: string;
  contentSha256: string;
  contentType: string;
  byteSize: number;
  reviewedBy: string;
  reviewedAt: string;
};

/**
 * Every gate that must hold before a reviewed photo may be shown or served, re-checked on EVERY request:
 * the listing is live/reserved and unexpired, the review belongs to the same tenant, and the reviewed
 * object is still one of the listing's current photos. Storage generation is checked separately by the
 * handler (a replaced or removed photo bumps/deletes it), so a stale review can never serve old bytes.
 */
export function canServePublicPhoto(
  listing: Pick<CarListing, "status" | "expiresAt" | "tenantId" | "photoPaths">,
  review: Pick<PublicListingPhotoReview, "tenantId" | "sourcePath"> | null | undefined,
  now: number,
): boolean {
  if (!review) return false;
  if (listing.status !== "live" && listing.status !== "reserved") return false;
  if (listing.expiresAt && Date.parse(listing.expiresAt) <= now) return false;
  if (review.tenantId !== listing.tenantId) return false;
  return listing.photoPaths.includes(review.sourcePath);
}

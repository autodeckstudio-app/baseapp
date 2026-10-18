import type { CarListing } from "@autodeck/core";

/** The only fields an anonymous visitor ever gets for a car. An explicit allowlist: new listing fields stay private until added here.
 *  No price, owner count, description, insurance date, seller, plate or photos (photo files are not plate-redacted, so none are sent). */
export const PUBLIC_LISTING_FIELDS = ["id", "status", "make", "model", "variant", "year", "kmDriven", "fuel", "gearbox", "bodyType", "colour", "area", "createdAt"] as const;

export function publicListingView(l: CarListing): Record<string, unknown> {
  const src = l as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_LISTING_FIELDS) out[k] = k === "bodyType" ? (l.bodyType ?? null) : src[k];
  out.photoUrls = [];
  out.priceHidden = true;
  out.mine = false;
  return out;
}

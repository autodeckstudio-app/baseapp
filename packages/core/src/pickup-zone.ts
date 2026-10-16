/** Beyond the free zone and up to this distance, pickup and drop costs a fee per leg. Further than this the studio does not collect. */
export const PICKUP_MAX_KM = 7;
/** Fee per leg, in paise: Rs 100 for pickup and Rs 100 for drop, so Rs 200 for both. Read from here by the server and the app, never typed twice. */
export const PICKUP_FEE_PER_LEG_PAISE = 10_000;

export type PickupKind = "pickup" | "drop" | "both";
/** Fee for a request: free inside 3 km, per leg from 3 to 7 km. A leg is one trip, so "both" is two. */
export function pickupFeePaise(tier: "free" | "fee" | "blocked", kind: PickupKind): number {
  return tier === "fee" ? PICKUP_FEE_PER_LEG_PAISE * (kind === "both" ? 2 : 1) : 0;
}

/** Where pickup and drop is free. Within this distance of the studio only. Beyond it the studio arranges it by phone. */
export const PICKUP_FREE_KM = 3;
/** The studio front door, geocoded from its address in studio-info (Sunbeam Complex, Ellisbridge). */
export const STUDIO_COORDS = { lat: 23.0192928, lng: 72.5614457 } as const;

/** Straight-line distance in km. Roads are longer, so the free zone is generous by a little. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PickupTier = "free" | "fee" | "blocked";

/** Free up to 3 km, a per-leg fee up to 7 km, then not offered (the customer calls the studio). Distances are straight-line. */
export function pickupZone(point: { lat: number; lng: number }): { km: number; within: boolean; tier: PickupTier; feePerLegPaise: number } {
  const km = haversineKm(STUDIO_COORDS, point);
  const tier: PickupTier = km <= PICKUP_FREE_KM ? "free" : km <= PICKUP_MAX_KM ? "fee" : "blocked";
  return { km: Math.round(km * 10) / 10, within: tier === "free", tier, feePerLegPaise: tier === "fee" ? PICKUP_FEE_PER_LEG_PAISE : 0 };
}

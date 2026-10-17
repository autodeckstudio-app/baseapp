/** Pickup and drop, one rule for every service (wash, garage, club). Free up to 3 km. From 3 to 5 km a flat fee per leg.
 *  Beyond 5 km the flat fee plus a per km charge on the distance past 5 km, like a ride app. A leg is one trip, so "both" is two legs.
 *  There is no distance limit. Values live here only: the server and the apps read them, never typed twice. */
export const PICKUP_FREE_KM = 3;
/** Up to here the fee is flat. Past it the per km charge starts. */
export const PICKUP_FLAT_KM = 5;
/** Flat fee per leg from 3 to 5 km, in paise: Rs 150. */
export const PICKUP_FEE_PER_LEG_PAISE = 15_000;
/** Charge per km past 5 km, in paise: Rs 15. Each started km counts, so a straight-line distance never undercharges a road trip. */
export const PICKUP_PER_KM_PAISE = 1_500;

export type PickupKind = "pickup" | "drop" | "both";

/** Fee for ONE leg at this distance, in paise. */
export function pickupLegFeePaise(km: number): number {
  if (km <= PICKUP_FREE_KM) return 0;
  if (km <= PICKUP_FLAT_KM) return PICKUP_FEE_PER_LEG_PAISE;
  return PICKUP_FEE_PER_LEG_PAISE + Math.ceil(Math.round((km - PICKUP_FLAT_KM) * 10) / 10) * PICKUP_PER_KM_PAISE;
}
/** Fee for a request at this distance: per leg, so "both" is twice one leg. */
export function pickupFeePaise(km: number, kind: PickupKind): number {
  return pickupLegFeePaise(km) * (kind === "both" ? 2 : 1);
}
/** Short text for the catalogue tile. Numbers come from the constants above. */
export const PICKUP_TILE_TEXT = `Free to ${PICKUP_FREE_KM} km`;

/** The studio front door, geocoded from its address in studio-info (Sunbeam Complex, Ellisbridge). */
export const STUDIO_COORDS = { lat: 23.0192928, lng: 72.5614457 } as const;

/** Straight-line distance in km. Roads are longer, so the fee is a little lower than a road trip would be. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PickupTier = "free" | "fee";

export function pickupZone(point: { lat: number; lng: number }): { km: number; within: boolean; tier: PickupTier; feePerLegPaise: number } {
  const km = Math.round(haversineKm(STUDIO_COORDS, point) * 10) / 10;
  return { km, within: km <= PICKUP_FREE_KM, tier: km <= PICKUP_FREE_KM ? "free" : "fee", feePerLegPaise: pickupLegFeePaise(km) };
}

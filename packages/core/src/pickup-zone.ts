/** Pickup and drop, one rule for every service (wash, garage, club). Two flat fees per leg, by straight-line distance from the studio:
 *  under 3 km Rs 100, 3 km and above Rs 150. A leg is one trip, so "both" is two legs. No per km charge, no free tier, no distance limit.
 *  Values live here only: the server and the apps read them, never typed twice. */
export const PICKUP_NEAR_KM = 3;
/** Fee per leg under PICKUP_NEAR_KM, in paise: Rs 100. */
export const PICKUP_NEAR_FEE_PAISE = 10_000;
/** Fee per leg at PICKUP_NEAR_KM and beyond, in paise: Rs 150. Exactly 3.0 km is this band. */
export const PICKUP_FAR_FEE_PAISE = 15_000;

export type PickupKind = "pickup" | "drop" | "both";

/** Fee for ONE leg at this distance, in paise. */
export function pickupLegFeePaise(km: number): number {
  return km < PICKUP_NEAR_KM ? PICKUP_NEAR_FEE_PAISE : PICKUP_FAR_FEE_PAISE;
}
/** Fee for a request at this distance: per leg, so "both" is twice one leg. */
export function pickupFeePaise(km: number, kind: PickupKind): number {
  return pickupLegFeePaise(km) * (kind === "both" ? 2 : 1);
}
/** Short text for the catalogue tile. Numbers come from the constants above. */
export const PICKUP_TILE_TEXT = `From Rs ${PICKUP_NEAR_FEE_PAISE / 100}`;

/** The studio front door, geocoded from its address in studio-info (Sunbeam Complex, Ellisbridge). */
export const STUDIO_COORDS = { lat: 23.0192928, lng: 72.5614457 } as const;

/** Straight-line distance in km. Roads are longer, so a road trip can be a little more than this. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PickupTier = "near" | "far";

/** The distance is cut down to 0.1 km (never rounded up) and the fee is read from that value, so what the customer sees is what is charged
 *  and the 3 km line is the real line: 2.96 km shows 2.9 km and is Rs 100, 3.0 km is Rs 150. */
export function pickupZone(point: { lat: number; lng: number }): { km: number; tier: PickupTier; feePerLegPaise: number } {
  const km = Math.floor(haversineKm(STUDIO_COORDS, point) * 10 + 1e-9) / 10;
  return { km, tier: km < PICKUP_NEAR_KM ? "near" : "far", feePerLegPaise: pickupLegFeePaise(km) };
}

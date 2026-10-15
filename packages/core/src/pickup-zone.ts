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

export function pickupZone(point: { lat: number; lng: number }): { km: number; within: boolean } {
  const km = haversineKm(STUDIO_COORDS, point);
  return { km: Math.round(km * 10) / 10, within: km <= PICKUP_FREE_KM };
}

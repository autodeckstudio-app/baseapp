/** Pickup and drop, one rule for every service (wash, garage, club), priced on the ROAD distance between the
 *  studio and the customer's spot, per selected leg: the first 3 road km of each leg are free, then Rs 25 per
 *  extra road km, computed from the actual metres the routing service returned - nearest paise, never rounded
 *  up to a whole km. "both" is two legs, each measured in the direction actually driven (pickup: the customer's
 *  spot to the studio; drop: the studio to the customer's spot) and each with its own free 3 km.
 *  Distances only ever arrive here as server-fetched metres; the client never supplies a distance.
 *  (Rule accepted by the studio owner on 2 Nov 2026; Google Routes spend approved by Meet on 3 Nov 2026 -
 *  see the channel record, this comment is only a pointer.)
 *  The pre-launch flat Rs 100/Rs 150 haversine tier is RETIRED: it never shipped to a durable client (the app
 *  is web-only, no native builds), and the server rejects pre-quote requests so a stale open tab is told to
 *  refresh and re-check the distance instead of being silently priced on either list. */
export type PickupKind = "pickup" | "drop" | "both";

/** The studio front door, geocoded from its address in studio-info (Sunbeam Complex, Ellisbridge). */
export const STUDIO_COORDS = { lat: 23.0192928, lng: 72.5614457 } as const;

/** Free road distance per leg, in metres: 3 km. */
export const PICKUP_FREE_ROAD_METERS = 3_000;
/** Rs 25 per extra road km, in paise per km. */
export const PICKUP_ROAD_RATE_PER_KM_PAISE = 2_500;

/** Fee for ONE leg at this road distance in metres, in paise, to the nearest paise (2.5 paise per extra metre). */
export function pickupLegFeePaiseForRoadMeters(roadMeters: number): number {
  return Math.round(Math.max(roadMeters - PICKUP_FREE_ROAD_METERS, 0) * (PICKUP_ROAD_RATE_PER_KM_PAISE / 1000));
}
/** Fee for a request from its per-leg road distances in metres: one entry per selected leg, each leg priced
 *  independently (routes can differ by direction, so "both" is NOT one route doubled). */
export function pickupLegsFeePaise(legMeters: readonly number[]): number {
  return legMeters.reduce((sum, m) => sum + pickupLegFeePaiseForRoadMeters(m), 0);
}
/** Display distance, cut down to 0.1 km (never rounded up) - display only; the fee always uses exact metres. */
export function pickupRoadKmForDisplay(roadMeters: number): number {
  return Math.floor(roadMeters / 100 + 1e-9) / 10;
}

/** Short text for the catalogue tile. Reflects the road-distance model (free first 3 road km per leg). */
export const PICKUP_TILE_TEXT = `Free up to ${PICKUP_FREE_ROAD_METERS / 1000} km`;

import { pickupEligibility, type PickupEligibilityInput } from "@autodeck/core";

/**
 * Admin view of a pickup request vs its booking, using the same matrix as Studio.
 * `bookings` is the tenant booking feed (capped at feedCap): a booking missing from a
 * full feed is unknown, not proof that it does not exist, so it is treated as actionable.
 */
export function pickupRowState(
  r: PickupEligibilityInput,
  bookingId: string,
  bookings: Record<string, string> | null,
  feedCap: number,
): { actionable: boolean; note: string | null } {
  if (bookings === null) return { actionable: true, note: null };
  const status = bookings[bookingId];
  if (status === undefined && Object.keys(bookings).length >= feedCap) return { actionable: true, note: null };
  return pickupEligibility(r, status ?? null);
}

import { pickupEligibility } from "@autodeck/core";
/** Booking statuses for which a pickup request can no longer be confirmed or marked done (it can still be declined to close it). */
export const PICKUP_BLOCKING_BOOKING_STATUSES: readonly string[] = ["CANCELLED", "EXPIRED", "NO_SHOW"];

/** A request whose booking is missing is blocked too (orphan). Pass undefined when the booking document does not exist. */
export function pickupBlockedByBooking(bookingStatus: string | undefined | null): boolean {
  return !bookingStatus || PICKUP_BLOCKING_BOOKING_STATUSES.includes(bookingStatus);
}

/**
 * Full server check for confirming or completing a request: the booking must exist and not be
 * cancelled/expired/no-show, and a COMPLETED booking only allows it while a return (drop) is owed or
 * the request just needs closing (same matrix Admin and Studio use). Stops a stale pickup-only
 * request on a finished job from taking a member's free-pickup credit.
 */
export function pickupBlockedForRequest(
  req: { kind: string; status: string; pickupCompletedAt?: string | null; dropCompletedAt?: string | null },
  bookingStatus: string | undefined | null,
): boolean {
  if (pickupBlockedByBooking(bookingStatus)) return true;
  if (bookingStatus === "COMPLETED") return !pickupEligibility(req, "COMPLETED").actionable;
  return false;
}

/** Booking statuses for which a pickup request can no longer be confirmed or marked done (it can still be declined to close it). */
export const PICKUP_BLOCKING_BOOKING_STATUSES: readonly string[] = ["CANCELLED", "EXPIRED", "NO_SHOW"];

/** A request whose booking is missing is blocked too (orphan). Pass undefined when the booking document does not exist. */
export function pickupBlockedByBooking(bookingStatus: string | undefined | null): boolean {
  return !bookingStatus || PICKUP_BLOCKING_BOOKING_STATUSES.includes(bookingStatus);
}

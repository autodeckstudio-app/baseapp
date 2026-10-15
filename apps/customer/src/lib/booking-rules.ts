// Reschedule and cancel rules for a customer booking, shared by the booking page and the Bookings list.
import type { Booking } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS, isBookingMissed } from "@autodeck/core";

const NON_RESCHEDULABLE_STATUS_REASONS: Record<string, string> = {
  PENDING: "This booking is still awaiting studio confirmation.",
  ACTIVE: "Your vehicle is already at the studio - contact the studio to change the schedule.",
  COMPLETED: "This booking is already completed.",
  CANCELLED: "This booking has been cancelled.",
  EXPIRED: "This booking has expired.",
};

export function getRescheduleEligibility(booking: Booking): { eligible: boolean; reason: string | null } {
  if (isBookingMissed(booking)) return { eligible: false, reason: "This booking was auto-cancelled at studio close. Make a new booking." };
  if (booking.status !== "CONFIRMED") {
    return { eligible: false, reason: NON_RESCHEDULABLE_STATUS_REASONS[booking.status] ?? "This booking can't be rescheduled." };
  }
  if (booking.rescheduleCount >= MAX_CUSTOMER_RESCHEDULES) {
    return {
      eligible: false,
      reason: `You've used all ${MAX_CUSTOMER_RESCHEDULES} reschedules for this booking. Contact the studio to change the time.`,
    };
  }
  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  if (hoursUntil < CANCELLATION_FREE_WINDOW_HOURS) {
    return {
      eligible: false,
      reason: `Less than ${CANCELLATION_FREE_WINDOW_HOURS} hours before your appointment - contact the studio directly to reschedule.`,
    };
  }
  return { eligible: true, reason: null };
}


/** Whether the customer can cancel online, or is too close to the start and must call. */
export function cancelState(booking: Booking, now = Date.now()): { canCancel: boolean; lateToCancel: boolean } {
  const missed = isBookingMissed(booking);
  const open = !missed && (booking.status === "CONFIRMED" || booking.status === "PENDING");
  const within = !missed && (new Date(booking.scheduledAt).getTime() - now) / 3600000 >= CANCELLATION_FREE_WINDOW_HOURS;
  return { canCancel: open && within, lateToCancel: open && !within };
}

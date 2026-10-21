// Reschedule and cancel rules for a customer booking, shared by the booking page and the Bookings list.
import type { Booking } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS, isBookingMissed, cancellationTerms, cancellationLine, REFUND_TIMELINE_TEXT } from "@autodeck/core";

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
    if (booking.status === "PENDING" && booking.payMode === "online") return { eligible: false, reason: "This booking is waiting for payment. Pay to confirm it, then you can reschedule." };
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


/** Whether the customer can cancel online. A cancel inside the free window costs a fee (core cancellation-policy), so it is allowed with the fee shown first.
 *  Once the car is at the studio (ACTIVE) work has started: no online cancel, call the studio. */

export function cancelState(booking: Booking, now = Date.now(), category?: string | null): { canCancel: boolean; lateToCancel: boolean; feePaise: number; line: string } {
  const missed = isBookingMissed(booking, now);
  const open = !missed && (booking.status === "CONFIRMED" || booking.status === "PENDING");
  const terms = cancellationTerms({ category, totalPaise: booking.totalAmount ?? 0, scheduledAtMs: new Date(booking.scheduledAt).getTime(), nowMs: now });
  return { canCancel: open, lateToCancel: !missed && booking.status === "ACTIVE", feePaise: terms.feePaise, line: cancellationLine(category) };
}

/** Text for the cancel confirmation: the rule, and the fee if one applies now. */
export function cancelConfirmBody(c: { feePaise: number; line: string }, paid: boolean): string {
  const fee = c.feePaise > 0 ? ` Cancelling now costs Rs ${c.feePaise / 100}, which is taken from your refund.` : "";
  const money = paid ? ` Your payment will be refunded to your original payment method in ${REFUND_TIMELINE_TEXT}.` : " The slot is released straight away and nothing is charged.";
  return `${c.line}${fee}${money} This can't be undone.`;
}

/** Extra services of a saved multi-service booking (lines minus the primary). Reschedule must ask for times that fit the whole visit, not the primary service alone. */
export function extraServiceIdsOf(booking: { serviceId: string; lines?: Array<{ serviceId: string }> }): string[] {
  return (booking.lines ?? []).map((l) => l.serviceId).filter((id) => id !== booking.serviceId);
}

const IST_MS = 5.5 * 3600_000;

/** "Expected ready" for the booking page. Never shows a time before the booking starts: if the stored end
 *  (studio date and time) is earlier than the start, use estimatedEndAt when that is sane, otherwise show nothing. */
export function expectedReady(b: Pick<Booking, "scheduledAt" | "estimatedEndAt" | "estimatedEndDate" | "estimatedEndTime">): { date: string; time: string } | null {
  const start = new Date(b.scheduledAt).getTime();
  if (Number.isNaN(start)) return null;
  const fromFields = new Date(`${b.estimatedEndDate}T${b.estimatedEndTime || "00:00"}:00Z`).getTime() - IST_MS;
  const fromInstant = new Date(b.estimatedEndAt).getTime();
  const end = !Number.isNaN(fromFields) && fromFields >= start ? fromFields : !Number.isNaN(fromInstant) && fromInstant >= start ? fromInstant : null;
  if (end === null) return null;
  const ist = new Date(end + IST_MS).toISOString();
  return { date: ist.slice(0, 10), time: ist.slice(11, 16) };
}

// Reschedule and cancel rules for a customer booking, shared by the booking page and the Bookings list.
import type { Booking } from "@autodeck/core";
import { rescheduleRule, isBiggerService, isBookingMissed, cancellationTerms, cancellationLine } from "@autodeck/core";

const NON_RESCHEDULABLE_STATUS_REASONS: Record<string, string> = {
  PENDING: "This booking is still awaiting studio confirmation.",
  ACTIVE: "Your vehicle is already at the studio - contact the studio to change the schedule.",
  COMPLETED: "This booking is already completed.",
  CANCELLED: "This booking has been cancelled.",
  EXPIRED: "This booking has expired.",
};

export function getRescheduleEligibility(booking: Booking, category?: string | null): { eligible: boolean; reason: string | null } {
  // Category-aware (basket item 6): wash gets one free move up to 4h ahead; other categories keep the legacy rule.
  const rule = rescheduleRule(category);
  if (isBookingMissed(booking)) return { eligible: false, reason: "This booking was auto-cancelled at studio close. Make a new booking." };
  if (booking.status !== "CONFIRMED") {
    if (booking.status === "PENDING" && booking.payMode === "online") return { eligible: false, reason: "This booking is waiting for payment. Pay to confirm it, then you can reschedule." };
    return { eligible: false, reason: NON_RESCHEDULABLE_STATUS_REASONS[booking.status] ?? "This booking can't be rescheduled." };
  }
  if (booking.rescheduleCount >= rule.maxCount) {
    return {
      eligible: false,
      reason: rule.maxCount === 1 ? "You've used your free reschedule for this booking. Contact the studio to change the time." : `You've used all ${rule.maxCount} reschedules for this booking. Contact the studio to change the time.`,
    };
  }
  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  if (hoursUntil < rule.cutoffHours) {
    return {
      eligible: false,
      reason: `Less than ${rule.cutoffHours} hours before your appointment - contact the studio directly to reschedule.`,
    };
  }
  return { eligible: true, reason: null };
}


/** Whether the customer can cancel online. A cancel inside the free window costs a fee (core cancellation-policy), so it is allowed with the fee shown first.
 *  Once the car is at the studio (ACTIVE) work has started: no online cancel, call the studio. */

export function cancelState(booking: Booking, now = Date.now(), category?: string | null): { canCancel: boolean; lateToCancel: boolean; feePaise: number; line: string } {
  const missed = isBookingMissed(booking, now);
  const open = booking.cancelIntent?.state !== "waiting" && booking.cancelIntent?.state !== "needs_review" && !missed && (booking.status === "CONFIRMED" || booking.status === "PENDING");
  const terms = cancellationTerms({ category, totalPaise: booking.totalAmount ?? 0, scheduledAtMs: new Date(booking.scheduledAt).getTime(), nowMs: now });
  return { canCancel: open, lateToCancel: !missed && booking.status === "ACTIVE", feePaise: terms.feePaise, line: cancellationLine(category) };
}

/** Text for the cancel confirmation: the rule, and the fee if one applies now. */
export function cancelConfirmBody(c: { feePaise: number; line: string }, paid: boolean): string {
  const fee = c.feePaise > 0 ? ` Cancelling now costs Rs ${c.feePaise / 100}, which is taken from your refund.` : "";
  const money = paid ? ` A refund request will be recorded for your original payment method. Timing depends on your bank or payment provider.` : " The slot is released straight away and nothing is charged.";
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

const AT_STUDIO_JOB = ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"];

/** The caption under the price block for an unpaid booking. Copy only: it never changes payment state. The bring-your-car line is shown only before the vehicle is at the studio. */
export function nextStepLine(o: { giftCovered: boolean; jobStatus?: string | null; time: string }): string {
  const atStudio = !!o.jobStatus && AT_STUDIO_JOB.includes(o.jobStatus);
  if (o.giftCovered) return atStudio ? "Your gift covers this wash." : `Next: bring your car at ${o.time}. Your gift covers this wash.`;
  return atStudio ? "You pay at the studio, and the team marks it paid once you do." : `Next: bring your car at ${o.time}. You pay at the studio, and the team marks it paid once you do.`;
}

/** Title of the time row under the booking details. The time is the plan, not a current estimate, once the planned end has
 *  passed without arrival or the job runs past it. Same time value either way; no new estimate is made. */
export function readyRowTitle(phase: string | undefined | null): "Planned end" | "Expected ready" {
  return phase === "not_arrived" || phase === "overrun" ? "Planned end" : "Expected ready";
}

/** Premium reschedule-request entry state (basket item 6, PREVIEW - flow not activated).
 *  Premium (pay-at-studio) bookings use the request-and-approve flow instead of a direct
 *  reschedule; washes and other categories keep the direct path. */
export function rescheduleEntry(
  booking: Booking,
  category?: string | null,
): { mode: "loading" } | { mode: "direct" } | { mode: "request" } | { mode: "request-pending"; requestedDate: string; requestedTime: string } | { mode: "request-used" } | { mode: "none"; reason: string } {
  // undefined category = the service catalogue has not loaded yet; render nothing
  // rather than flashing the wrong path (null = definitively unknown -> direct/legacy).
  if (category === undefined) return { mode: "loading" };
  if (!isBiggerService(category)) return { mode: "direct" };
  // Missed premium bookings: the disclosed existing policy (booking detail copy) is
  // "contact the studio / make a new booking". The server's missed-move bypass in
  // rescheduleBooking predates the request flow and would allow a direct move - a
  // genuine UI/server inconsistency now flagged for the owner batch, NOT resolved
  // here by changing either side. The no-show-retention x missed-reschedule
  // financial interaction is likewise an explicit open flag.
  if (booking.status !== "CONFIRMED" || isBookingMissed(booking)) return { mode: "none", reason: "This booking can't be rescheduled online - contact the studio." };
  const req = booking.rescheduleRequest;
  if (req?.status === "pending") return { mode: "request-pending", requestedDate: req.requestedDate, requestedTime: req.requestedTime };
  if ((booking.rescheduleRequestCount ?? 0) >= 1) return { mode: "request-used" };
  return { mode: "request" };
}

/** Format a studio-local date+time for display without letting the DEVICE timezone
 *  reinterpret the wall time: parsing "2026-11-10T14:00:00" bare reads it as
 *  device-local and the IST display then shifts on non-IST devices (reviewer
 *  finding). Pin the IST offset first, then format in IST. */
export function formatStudioLocal(date: string, time: string): string {
  const instant = new Date(`${date}T${time}:00+05:30`);
  return instant.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true });
}

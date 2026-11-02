// Premium reschedule REQUEST guards (basket item 6, premium half - PREVIEW).
// A premium booking cannot self-serve a reschedule once this flow is activated;
// the customer requests a new time and an admin approves or declines. These are
// pure guards so they can be unit-tested without the emulator. The callable and
// the approve/decline path keep their own runtime checks; nothing here moves a
// slot, touches payment fields, or mutates state.
import { isBiggerService, PREMIUM_REQUEST_CUTOFF_HOURS } from "@autodeck/core";

export { PREMIUM_REQUEST_CUTOFF_HOURS };

export type RescheduleRequestState = {
  status: string;
  baseScheduledAt: string;
  requestedDate?: string;
  requestedTime?: string;
  idempotencyKey?: string;
  decisionIdempotencyKey?: string | null;
};

/** Exactly-once retry check for a request submission. The caller must only
 *  consult this while a request record exists; it classifies the retry:
 *  - "retry": same key AND same requested slot -> return the existing request
 *  - "conflict": same key, different slot -> never silently apply
 *  - "new": different key -> a genuinely new submission attempt (the pending/
 *    one-per-booking guards decide whether that is allowed) */
export function classifyRequestRetry(
  existing: RescheduleRequestState,
  input: { newDate: string; newTime: string; idempotencyKey: string },
): "retry" | "conflict" | "new" {
  if (existing.idempotencyKey !== input.idempotencyKey) return "new";
  if (existing.requestedDate === input.newDate && existing.requestedTime === input.newTime) return "retry";
  return "conflict";
}

/** Exactly-once retry check for a decision on a terminal request:
 *  - "retry": same decision key AND same approve value -> return current state
 *  - "conflict": same decision key, different approve value
 *  - "new": different key -> a fresh decision attempt on a decided request */
export function classifyDecisionRetry(
  existing: RescheduleRequestState,
  input: { approve: boolean; idempotencyKey: string },
): "retry" | "conflict" | "new" {
  if (existing.decisionIdempotencyKey !== input.idempotencyKey) return "new";
  const wasApproved = existing.status === "approved";
  if (wasApproved === input.approve) return "retry";
  return "conflict";
}

export type RequestGuardBooking = {
  status: string;
  scheduledAt: string;
  rescheduleRequest?: RescheduleRequestState | null;
  /** Submissions so far (absent = 0). The adopted premium rule is ONE request
   *  per booking; a terminal request does not reset this. */
  rescheduleRequestCount?: number;
};

/** Adopted premium rule: one reschedule request per booking (basket item 6). */
export const PREMIUM_REQUEST_MAX_COUNT = 1;

/** Premium = the pay-at-studio service groups (same banding the cancellation
 *  policy uses), so reschedule policy stays consistent with cancellation. */
export function isPremiumCategory(category: string | null | undefined): boolean {
  return isBiggerService(category);
}

/** Whether the customer may submit a reschedule request now. Interpretation
 *  decision: ">=24h" is measured against the CURRENT appointment start - the
 *  studio needs a full day to decide - and the requested new time must itself
 *  be in the future. */
export function canRequestReschedule(
  booking: RequestGuardBooking,
  category: string | null | undefined,
  now: Date,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!isPremiumCategory(category)) {
    return { ok: false, code: "failed-precondition", message: "Reschedule requests are only needed for premium services - this booking can be rescheduled directly." };
  }
  if (booking.status !== "CONFIRMED") {
    return { ok: false, code: "failed-precondition", message: `Cannot request a reschedule for a booking with status ${booking.status}.` };
  }
  if (booking.rescheduleRequest && booking.rescheduleRequest.status === "pending") {
    return { ok: false, code: "already-exists", message: "A reschedule request is already pending for this booking." };
  }
  if ((booking.rescheduleRequestCount ?? 0) >= PREMIUM_REQUEST_MAX_COUNT) {
    return { ok: false, code: "failed-precondition", message: "You've already used the reschedule request for this booking. Contact the studio to change the time." };
  }
  const hoursUntil = (new Date(booking.scheduledAt).getTime() - now.getTime()) / 3600000;
  if (hoursUntil < PREMIUM_REQUEST_CUTOFF_HOURS) {
    return { ok: false, code: "failed-precondition", message: `Reschedule requests must be made at least ${PREMIUM_REQUEST_CUTOFF_HOURS} hours before the appointment.` };
  }
  return { ok: true };
}

/** Whether a pending request can still be decided. Guards against stale
 *  approvals: the booking must not have moved or changed status since the
 *  request was made, and the request must still be pending. */
export function canDecideRescheduleRequest(
  booking: RequestGuardBooking,
  request: RescheduleRequestState,
): { ok: true } | { ok: false; code: string; message: string } {
  if (request.status !== "pending") {
    return { ok: false, code: "failed-precondition", message: `This reschedule request is already ${request.status}.` };
  }
  if (booking.status !== "CONFIRMED") {
    return { ok: false, code: "failed-precondition", message: `The booking is no longer confirmed (status ${booking.status}); the request cannot be decided.` };
  }
  if (booking.scheduledAt !== request.baseScheduledAt) {
    return { ok: false, code: "failed-precondition", message: "The booking has changed since this request was made. Ask the customer to submit a new request." };
  }
  return { ok: true };
}

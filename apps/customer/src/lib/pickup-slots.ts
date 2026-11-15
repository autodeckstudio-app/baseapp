// Hourly pickup-time preference slots for the booking day. A pickup must
// happen before the service starts, so only slots strictly earlier than the booking's own
// scheduled time are offered: a 13:30 booking can request 13:00, not 13:30.
// Times are "HH:mm" in the studio timezone, the same format the booking
// flow already carries (AvailableSlot.startTime / confirm screen params).
//
// Slots exist only from grounded hours: the booking day's opening time comes
// from the live studio record - the same hours the booking engine used to
// offer the slot. While that record is loading, after a failed fetch, or on
// a closed day there is no list and no invented default: the booking and the
// pickup request stand either way, the time preference simply is not
// offered until hours are known.
import type { LiveStudioInfo } from "./studio-info";

const toMinutes = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins < 24 * 60 ? mins : null;
};

const toClock = (mins: number): string => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function pickupSlotsFor(scheduledTime: string, openTime: string): string[] {
  const open = toMinutes(openTime);
  const latest = toMinutes(scheduledTime);
  if (open === null || latest === null) return [];
  const slots: string[] = [];
  for (let mins = open; mins < latest; mins += 60) slots.push(toClock(mins));
  return slots;
}

/** Where the booking day's hours stand for the pickup-time preference. */
export type PickupDayHours =
  | { status: "loading" }
  // The fetch failed, the day has no hours entry, or the studio is closed
  // that day. No list is offered - hours are not invented.
  | { status: "unavailable" }
  | { status: "open"; open: string };

/**
 * Resolves the booking day's hours from the live studio record. The weekday
 * comes from the calendar date string itself, so no timezone conversion is
 * involved.
 */
export function pickupDayHoursFor(info: LiveStudioInfo, scheduledDate: string): PickupDayHours {
  if (!scheduledDate) return { status: "unavailable" };
  const dow = new Date(`${scheduledDate}T00:00:00Z`).getUTCDay();
  const hours = info.operatingHours.find((h) => h.dayOfWeek === dow);
  return hours && !hours.closed ? { status: "open", open: hours.open } : { status: "unavailable" };
}

/** The dropdown's options: a real list only when the day's hours are grounded and open. */
export function pickupSlotOptions(scheduledTime: string | undefined, hours: PickupDayHours): string[] {
  if (!scheduledTime || hours.status !== "open") return [];
  return pickupSlotsFor(scheduledTime, hours.open);
}

/**
 * A chosen preference is valid only while it is one of the current options.
 * When live hours arrive with a different opening time, the booking date
 * changes, or hours become unavailable, a stale choice is dropped so it is
 * neither shown nor sent.
 */
export function validPickupSlot(chosen: string, options: string[]): string {
  return options.includes(chosen) ? chosen : "";
}

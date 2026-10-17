// Priority slots. Each open day the first PRIORITY_HELD_PER_DAY start times are held for members whose plan has a priority slot.
// The hold ends at 18:00 studio time the evening before; after that the slots are open to everyone. Pure: no Firestore.
import type { Membership, OperatingHours } from "@autodeck/core";
import { generateDaySlots } from "./availability.js";
import { addDays, getDayOfWeek, isHoliday, localToUTC } from "./schedule.js";

export const PRIORITY_HELD_PER_DAY = 2;
export const PRIORITY_RELEASE_TIME = "18:00";

/** The start times held on one date: the earliest slots a service of this length could start in, ignoring bookings so the answer never moves. */
export function heldStartTimes(p: { date: string; serviceDurationMinutes: number; operatingHours: OperatingHours[]; holidays: string[]; timezone: string }): string[] {
  const hours = p.operatingHours.find((h) => h.dayOfWeek === getDayOfWeek(p.date));
  if (!hours || hours.closed || isHoliday(p.date, p.holidays)) return [];
  const slots = generateDaySlots({ date: p.date, openTime: hours.open, closeTime: hours.close, serviceDurationMinutes: p.serviceDurationMinutes, occupiedIntervals: [], timezone: p.timezone, operatingHours: p.operatingHours, holidays: p.holidays });
  return [...new Set(slots.map((s) => s.startTime))].sort().slice(0, PRIORITY_HELD_PER_DAY);
}

/** When the hold on a date ends: 18:00 the evening before. */
export function holdEndsAt(date: string, timezone: string): Date {
  return localToUTC(addDays(date, -1), PRIORITY_RELEASE_TIME, timezone);
}

export function isPriorityHeld(p: { date: string; startTime: string; held: string[]; now: Date; timezone: string }): boolean {
  return p.held.includes(p.startTime) && p.now < holdEndsAt(p.date, p.timezone);
}

type M = Pick<Membership, "status" | "endDate"> & { prioritySlot?: boolean };
/** True when the customer has an active, in-date membership with a priority slot. */
export function hasPriorityMembership(list: M[], todayDate: string): boolean {
  return list.some((m) => m.status === "active" && m.prioritySlot === true && (!m.endDate || m.endDate >= todayDate));
}

// Pure slot-generation algorithm for the booking engine. No Firebase imports.
// All inputs come from the caller (Cloud Function); outputs are plain objects.
import type { OperatingHours, Bay, BayType } from "@autodeck/core";
import { SLOT_INTERVAL_MINUTES, TURNOVER_BUFFER_MINUTES } from "@autodeck/core";
import {
  localToUTC,
  utcToLocalDate,
  timeToMinutes,
  minutesToTime,
  addDays,
  getDayOfWeek,
  isHoliday,
} from "./schedule.js";

export interface OccupiedInterval {
  startAt: Date; // UTC inclusive
  endAt: Date; // UTC exclusive (already includes the 15-min buffer of the occupying job)
}

export interface AvailableSlot {
  date: string; // "YYYY-MM-DD" in studio TZ
  startTime: string; // "HH:mm" in studio TZ
  endTime: string; // "HH:mm" — service end, before buffer
  startAt: string; // ISO UTC
  estimatedEndAt: string; // ISO UTC = startAt + serviceDurationMinutes
}

export interface GenerateDaySlotsParams {
  date: string; // "YYYY-MM-DD" in studio TZ
  openTime: string; // "HH:mm" from operatingHours
  closeTime: string; // "HH:mm" from operatingHours
  serviceDurationMinutes: number; // actual service duration (no buffer)
  occupiedIntervals: OccupiedInterval[]; // per-bay intervals (with buffer baked in)
  timezone: string;
}

// Returns all available start times for a single bay on a single day.
// slotDuration = serviceDuration + TURNOVER_BUFFER_MINUTES
// A candidate slot at T is valid if [T, T+slotDuration) doesn't overlap any occupied interval.
export function generateDaySlots(params: GenerateDaySlotsParams): AvailableSlot[] {
  const { date, openTime, closeTime, serviceDurationMinutes, occupiedIntervals, timezone } =
    params;

  const slotDuration = serviceDurationMinutes + TURNOVER_BUFFER_MINUTES;
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);

  // Last valid start: the job (incl. buffer) must finish by close time
  const maxStartMin = closeMin - slotDuration;
  if (maxStartMin < openMin) return []; // service doesn't fit in this day

  const slots: AvailableSlot[] = [];
  let candidate = openMin;

  while (candidate <= maxStartMin) {
    const candidateStartTime = minutesToTime(candidate);
    const candidateEndTime = minutesToTime(candidate + serviceDurationMinutes);

    const startUTC = localToUTC(date, candidateStartTime, timezone);
    const endUTC = new Date(startUTC.getTime() + slotDuration * 60000);

    const blocked = occupiedIntervals.some(
      ({ startAt, endAt }) => startUTC < endAt && endUTC > startAt,
    );

    if (!blocked) {
      slots.push({
        date,
        startTime: candidateStartTime,
        endTime: candidateEndTime,
        startAt: startUTC.toISOString(),
        estimatedEndAt: new Date(
          startUTC.getTime() + serviceDurationMinutes * 60000,
        ).toISOString(),
      });
    }

    candidate += SLOT_INTERVAL_MINUTES;
  }

  return slots;
}

export interface ComputeAvailabilityParams {
  startDate: string; // "YYYY-MM-DD" — first date to consider
  lookAheadDays: number;
  serviceDurationMinutes: number;
  requiredBayType: BayType;
  bays: Bay[]; // all bays from studioConfig
  operatingHours: OperatingHours[]; // indexed by dayOfWeek
  holidays: string[]; // ISO date strings
  timezone: string;
  // jobsByBayDate: preloaded bay→date→jobs map from caller
  occupiedByBay: Map<string, OccupiedInterval[]>; // bayId → intervals for the target date range
}

// Top-level availability computation across multiple bays and days.
// Returns a flat list of unique start times (de-duplicated across bays).
// Slot visibility: caller can cap at maxResults.
export function computeAvailability(params: ComputeAvailabilityParams): AvailableSlot[] {
  const {
    startDate,
    lookAheadDays,
    serviceDurationMinutes,
    requiredBayType,
    bays,
    operatingHours,
    holidays,
    timezone,
  } = params;

  const activeBays = bays.filter((b) => b.active && b.bayType === requiredBayType);
  if (activeBays.length === 0) return [];

  // Collect all unique (date, startTime) pairs across all bays.
  // A slot is returned if at least one compatible bay has it free.
  const seenSlots = new Set<string>(); // "date|HH:mm"
  const results: AvailableSlot[] = [];

  for (let d = 0; d < lookAheadDays; d++) {
    const date = addDays(startDate, d);

    if (isHoliday(date, holidays)) continue;

    const dow = getDayOfWeek(date);
    const hours = operatingHours.find((h) => h.dayOfWeek === dow);
    if (!hours || hours.closed) continue;

    for (const bay of activeBays) {
      const occupied = params.occupiedByBay.get(bay.id) ?? [];
      const daySlots = generateDaySlots({
        date,
        openTime: hours.open,
        closeTime: hours.close,
        serviceDurationMinutes,
        occupiedIntervals: occupied,
        timezone,
      });

      for (const slot of daySlots) {
        const key = `${slot.date}|${slot.startTime}`;
        if (!seenSlots.has(key)) {
          seenSlots.add(key);
          results.push(slot);
        }
      }
    }
  }

  return results;
}

// Builds OccupiedIntervals from raw job/booking data.
// endAt includes the 15-min turnover buffer.
export function buildOccupiedInterval(
  scheduledAtISO: string,
  estimatedEndAtISO: string,
): OccupiedInterval {
  const startAt = new Date(scheduledAtISO);
  const rawEnd = new Date(estimatedEndAtISO);
  const endAt = new Date(rawEnd.getTime() + TURNOVER_BUFFER_MINUTES * 60000);
  return { startAt, endAt };
}

// Checks if a requested slot (startAt, duration) conflicts with any occupied interval.
// The new slot's blocked range is [startAt, startAt + duration + buffer].
export function hasConflict(
  startAt: Date,
  serviceDurationMinutes: number,
  occupied: OccupiedInterval[],
): boolean {
  const slotDuration = serviceDurationMinutes + TURNOVER_BUFFER_MINUTES;
  const endAt = new Date(startAt.getTime() + slotDuration * 60000);
  return occupied.some((o) => startAt < o.endAt && endAt > o.startAt);
}

// Returns the "local date" string for a UTC timestamp in the studio timezone.
export { utcToLocalDate };

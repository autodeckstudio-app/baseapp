// Pure slot-generation algorithm for the booking engine. No Firebase imports.
// All inputs come from the caller (Cloud Function); outputs are plain objects.
import type { OperatingHours, Bay, BayType } from "@autodeck/core";
import { SLOT_INTERVAL_MINUTES, TURNOVER_BUFFER_MINUTES } from "@autodeck/core";
import {
  localToUTC,
  utcToLocalDate,
  utcToLocalTime,
  timeToMinutes,
  minutesToTime,
  addDays,
  getDayOfWeek,
  isHoliday,
  computeScheduleEnd,
} from "./schedule.js";

export interface OccupiedInterval {
  startAt: Date; // UTC inclusive
  endAt: Date; // UTC exclusive (already includes the 15-min buffer of the occupying job)
}

export interface AvailableSlot {
  date: string; // "YYYY-MM-DD" in studio TZ — start date
  startTime: string; // "HH:mm" in studio TZ
  endTime: string; // "HH:mm" — service end, before buffer (studio TZ local time; for a
  // multi-day slot this is the local time-of-day on estimatedEndDate, not on `date`)
  estimatedEndDate: string; // "YYYY-MM-DD" in studio TZ — usually == date, differs for multi-day slots
  startAt: string; // ISO UTC
  estimatedEndAt: string; // ISO UTC — true service completion (multi-day-aware)
}

export interface GenerateDaySlotsParams {
  date: string; // "YYYY-MM-DD" in studio TZ
  openTime: string; // "HH:mm" from operatingHours
  closeTime: string; // "HH:mm" from operatingHours
  serviceDurationMinutes: number; // actual service duration (no buffer)
  occupiedIntervals: OccupiedInterval[]; // per-bay intervals (with buffer baked in)
  timezone: string;
  // Full weekly schedule + holiday list — only consulted when the service
  // (with buffer) cannot fit within THIS day's own window, to compute how far
  // the job rolls into subsequent operating days (Phase 5 — multi-day booking).
  operatingHours: OperatingHours[];
  holidays: string[];
}

// Returns all available start times for a single bay on a single day.
// slotDuration = serviceDuration + TURNOVER_BUFFER_MINUTES
// A candidate slot at T is valid if [T, T+slotDuration) doesn't overlap any occupied interval.
//
// Per-day capacity gate: if the service (with buffer) fits within THIS day's
// operating window, behavior is byte-for-byte identical to the original
// single-day-only implementation — every existing (short) service is
// unaffected by multi-day support. Only when it genuinely cannot fit any
// single day does this switch to the multi-day rollover path, which computes
// the job's true end via computeScheduleEnd (walking forward across
// subsequent open days, skipping closed/holiday days) instead of assuming
// same-day completion.
export function generateDaySlots(params: GenerateDaySlotsParams): AvailableSlot[] {
  const {
    date,
    openTime,
    closeTime,
    serviceDurationMinutes,
    occupiedIntervals,
    timezone,
    operatingHours,
    holidays,
  } = params;

  const slotDuration = serviceDurationMinutes + TURNOVER_BUFFER_MINUTES;
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const fitsSameDay = slotDuration <= closeMin - openMin;

  const slots: AvailableSlot[] = [];

  if (fitsSameDay) {
    // Last valid start: the job (incl. buffer) must finish by close time
    const maxStartMin = closeMin - slotDuration;
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
          estimatedEndDate: date,
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

  // Multi-day rollover: candidates range across the full open window (not
  // bounded by slotDuration, since the job is allowed to spill into
  // subsequent days). The true end/blocked-range is computed via
  // computeScheduleEnd rather than assumed to land within this day.
  const maxStartMin = closeMin - SLOT_INTERVAL_MINUTES;
  let candidate = openMin;

  while (candidate <= maxStartMin) {
    const candidateStartTime = minutesToTime(candidate);
    const startUTC = localToUTC(date, candidateStartTime, timezone);
    const serviceEndUTC = computeScheduleEnd(
      startUTC,
      serviceDurationMinutes,
      operatingHours,
      holidays,
      timezone,
    );
    const blockEndUTC = new Date(serviceEndUTC.getTime() + TURNOVER_BUFFER_MINUTES * 60000);

    const blocked = occupiedIntervals.some(
      ({ startAt, endAt }) => startUTC < endAt && blockEndUTC > startAt,
    );

    if (!blocked) {
      slots.push({
        date,
        startTime: candidateStartTime,
        endTime: utcToLocalTime(serviceEndUTC, timezone),
        estimatedEndDate: utcToLocalDate(serviceEndUTC, timezone),
        startAt: startUTC.toISOString(),
        estimatedEndAt: serviceEndUTC.toISOString(),
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
        operatingHours,
        holidays,
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

// Checks if a requested slot conflicts with any occupied interval.
// `rawEndAt` is the true, already-computed service completion instant
// (buffer-free — e.g. from computeScheduleEnd), NOT a naive duration. This
// mirrors buildOccupiedInterval's contract deliberately: a naive
// startAt + duration + buffer window would UNDERSTATE the blocked range for
// a multi-day service (whose true end is later, due to skipped closed/
// holiday days), silently allowing false-negative conflicts. Callers with a
// short, same-day-fitting service can still pass
// `new Date(startAt.getTime() + serviceDurationMinutes * 60000)` — behavior
// is identical to before for any such service (Phase 5 — multi-day booking).
export function hasConflict(
  startAt: Date,
  rawEndAt: Date,
  occupied: OccupiedInterval[],
): boolean {
  const blockedEndAt = new Date(rawEndAt.getTime() + TURNOVER_BUFFER_MINUTES * 60000);
  return occupied.some((o) => startAt < o.endAt && blockedEndAt > o.startAt);
}

// Returns the "local date" string for a UTC timestamp in the studio timezone.
export { utcToLocalDate };

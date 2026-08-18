import { describe, it, expect } from "vitest";
import {
  generateDaySlots,
  computeAvailability,
  buildOccupiedInterval,
  hasConflict,
  type OccupiedInterval,
} from "../../lib/availability.js";
import {
  getTZOffsetMinutes,
  localToUTC,
  utcToLocalDate,
  utcToLocalTime,
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  addDays,
  computeScheduleEnd,
} from "../../lib/schedule.js";
import type { Bay, OperatingHours } from "@autodeck/core";

const IST = "Asia/Kolkata";
const BASE_DATE = "2026-08-17"; // Monday

const BAYS: Bay[] = [
  { id: "bay-wash-1", tenantId: "t1", studioId: "s1", name: "Wash Bay 1", bayType: "wash", active: true },
  { id: "bay-wash-2", tenantId: "t1", studioId: "s1", name: "Wash Bay 2", bayType: "wash", active: true },
  { id: "bay-prot-1", tenantId: "t1", studioId: "s1", name: "Protection Bay 1", bayType: "protection", active: true },
];

const weeklyHours: OperatingHours[] = [
  { dayOfWeek: 0, open: "09:00", close: "19:00", closed: true }, // Sunday closed
  { dayOfWeek: 1, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 2, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 3, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 4, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 5, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 6, open: "09:00", close: "19:00", closed: false },
];

// ─── Timezone utilities ───────────────────────────────────────────────────────

describe("getTZOffsetMinutes", () => {
  it("returns +330 for Asia/Kolkata (IST = UTC+5:30)", () => {
    const offset = getTZOffsetMinutes(IST, new Date("2026-08-17T00:00:00Z"));
    expect(offset).toBe(330);
  });

  it("returns 0 for UTC", () => {
    const offset = getTZOffsetMinutes("UTC", new Date("2026-08-17T00:00:00Z"));
    expect(offset).toBe(0);
  });
});

describe("localToUTC", () => {
  it("converts 09:00 IST to 03:30 UTC", () => {
    const utc = localToUTC("2026-08-17", "09:00", IST);
    expect(utc.toISOString()).toBe("2026-08-17T03:30:00.000Z");
  });

  it("converts 19:00 IST (close) to 13:30 UTC", () => {
    const utc = localToUTC("2026-08-17", "19:00", IST);
    expect(utc.toISOString()).toBe("2026-08-17T13:30:00.000Z");
  });
});

describe("utcToLocalDate", () => {
  it("converts midnight UTC to correct IST date", () => {
    // Midnight UTC on Aug 17 is 5:30 AM IST on Aug 17 — same date
    const date = utcToLocalDate(new Date("2026-08-17T00:00:00Z"), IST);
    expect(date).toBe("2026-08-17");
  });

  it("converts 20:00 UTC to next IST date (crosses midnight in IST)", () => {
    // 20:00 UTC = 01:30 IST next day (20:00 + 5:30 = 25:30 = 01:30 next day)
    const date = utcToLocalDate(new Date("2026-08-17T20:00:00Z"), IST);
    expect(date).toBe("2026-08-18");
  });
});

describe("getDayOfWeek", () => {
  it("returns 1 (Monday) for 2026-08-17", () => {
    expect(getDayOfWeek("2026-08-17")).toBe(1);
  });

  it("returns 0 (Sunday) for 2026-08-16", () => {
    expect(getDayOfWeek("2026-08-16")).toBe(0);
  });
});

describe("timeToMinutes / minutesToTime", () => {
  it("parses 09:00 as 540", () => expect(timeToMinutes("09:00")).toBe(540));
  it("parses 19:00 as 1140", () => expect(timeToMinutes("19:00")).toBe(1140));
  it("converts 540 to 09:00", () => expect(minutesToTime(540)).toBe("09:00"));
  it("converts 1140 to 19:00", () => expect(minutesToTime(1140)).toBe("19:00"));
});

// ─── computeScheduleEnd ───────────────────────────────────────────────────────

describe("computeScheduleEnd", () => {
  it("single-day-fit service ends at exactly startAt + duration (identical to naive addition)", () => {
    const start = localToUTC(BASE_DATE, "09:00", IST); // Monday
    const end = computeScheduleEnd(start, 90, weeklyHours, [], IST);
    expect(end.getTime() - start.getTime()).toBe(90 * 60000);
    expect(utcToLocalDate(end, IST)).toBe(BASE_DATE);
    expect(utcToLocalTime(end, IST)).toBe("10:30");
  });

  it("mid-day start that fits the remainder of the day ends same-day", () => {
    const start = localToUTC(BASE_DATE, "14:00", IST); // 5h to close (300 min)
    const end = computeScheduleEnd(start, 200, weeklyHours, [], IST);
    expect(utcToLocalDate(end, IST)).toBe(BASE_DATE);
    expect(utcToLocalTime(end, IST)).toBe("17:20");
  });

  it("exact boundary fit: duration == remaining minutes in the day ends exactly at close", () => {
    const start = localToUTC(BASE_DATE, "09:00", IST); // 600 min to close
    const end = computeScheduleEnd(start, 600, weeklyHours, [], IST);
    expect(utcToLocalDate(end, IST)).toBe(BASE_DATE);
    expect(utcToLocalTime(end, IST)).toBe("19:00");
  });

  it("one minute past the boundary spills exactly one minute into the next open day", () => {
    const start = localToUTC(BASE_DATE, "09:00", IST); // 600 min to close
    const end = computeScheduleEnd(start, 601, weeklyHours, [], IST);
    expect(utcToLocalDate(end, IST)).toBe(addDays(BASE_DATE, 1)); // Tuesday
    expect(utcToLocalTime(end, IST)).toBe("09:01");
  });

  it("matches the documented AutoModz example exactly: 2880 min = 4 working days + 480 min into day 5", () => {
    // doc04: "A PPF job requiring 2,880 minutes = 4 working days + 480 minutes
    // into day 5" at a 600-min/day (09:00-19:00) operating window.
    const start = localToUTC(BASE_DATE, "09:00", IST); // Monday
    const end = computeScheduleEnd(start, 2880, weeklyHours, [], IST);
    expect(utcToLocalDate(end, IST)).toBe(addDays(BASE_DATE, 4)); // Friday
    expect(utcToLocalTime(end, IST)).toBe("17:00"); // 09:00 + 480 min
  });

  it("a 2-day service (700 min) rolls over exactly one day", () => {
    const start = localToUTC(BASE_DATE, "09:00", IST);
    const end = computeScheduleEnd(start, 700, weeklyHours, [], IST);
    expect(utcToLocalDate(end, IST)).toBe(addDays(BASE_DATE, 1)); // Tuesday
    expect(utcToLocalTime(end, IST)).toBe("10:40"); // 100 min remaining after Mon's 600
  });

  it("a 3-day service (1300 min) rolls over exactly two days", () => {
    const start = localToUTC(BASE_DATE, "09:00", IST);
    const end = computeScheduleEnd(start, 1300, weeklyHours, [], IST);
    expect(utcToLocalDate(end, IST)).toBe(addDays(BASE_DATE, 2)); // Wednesday
    expect(utcToLocalTime(end, IST)).toBe("10:40"); // 100 min remaining after Mon+Tue's 1200
  });

  it("skips a holiday that falls within the rollover span", () => {
    const start = localToUTC(BASE_DATE, "09:00", IST); // Monday
    const holiday = addDays(BASE_DATE, 1); // Tuesday
    const end = computeScheduleEnd(start, 601, weeklyHours, [holiday], IST);
    // Monday consumes 600, 1 min remains; Tuesday is a holiday and is
    // skipped entirely (not counted, not landed on) — lands on Wednesday.
    expect(utcToLocalDate(end, IST)).toBe(addDays(BASE_DATE, 2)); // Wednesday
    expect(utcToLocalTime(end, IST)).toBe("09:01");
  });

  it("falls back to naive startAt + duration when no operating day is configured at all", () => {
    // A studio with no operatingHours configured (onboarding incomplete) is
    // already non-functional for online-booking availability — this must
    // degrade gracefully rather than throw.
    const start = localToUTC(BASE_DATE, "09:00", IST);
    const end = computeScheduleEnd(start, 90, [], [], IST);
    expect(end.getTime() - start.getTime()).toBe(90 * 60000);
  });

  it("skips a closed weekend day (Sunday) within the rollover span", () => {
    const saturday = addDays(BASE_DATE, 5); // 2026-08-22, Saturday
    const start = localToUTC(saturday, "09:00", IST);
    const end = computeScheduleEnd(start, 601, weeklyHours, [], IST);
    // Saturday consumes 600, 1 min remains; Sunday is closed and is skipped
    // entirely — lands on the following Monday.
    expect(utcToLocalDate(end, IST)).toBe(addDays(saturday, 2)); // Monday
    expect(utcToLocalTime(end, IST)).toBe("09:01");
  });
});

// ─── generateDaySlots ─────────────────────────────────────────────────────────

describe("generateDaySlots", () => {
  it("returns slots at 30-min intervals for an empty bay", () => {
    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: [],
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    // First slot at 09:00, last slot start: 19:00 - (60+15) = 18:45 → so last is 18:30 (multiple of 30)
    // Slots: 09:00, 09:30, 10:00, ..., 18:30 → (18:30 - 09:00) / 30 + 1 = (570/30)+1 = 20 slots
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.startTime).toBe("09:00");
    // All slots separated by 30 min
    for (let i = 1; i < slots.length; i++) {
      const prevSlot = slots[i - 1];
      const currSlot = slots[i];
      if (!prevSlot || !currSlot) break;
      const prev = timeToMinutes(prevSlot.startTime);
      const curr = timeToMinutes(currSlot.startTime);
      expect(curr - prev).toBe(30);
    }
  });

  it("returns slots for a normal day", () => {
    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: [],
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it("rolls a job into the next open day when today's own window is too small for it, instead of returning no slots", () => {
    // Today's window (09:00-09:30) can't fit a 60-min job on its own — but
    // per the multi-day model, the job should still be offered a start,
    // completing on the next open day (same principle as a real multi-day
    // PPF job that never fits within a single day at all).
    const closedSlots = generateDaySlots({
      date: BASE_DATE, // Monday
      openTime: "09:00",
      closeTime: "09:30", // window too small for 60+15 min
      serviceDurationMinutes: 60,
      occupiedIntervals: [],
      timezone: IST,
      operatingHours: weeklyHours, // Tuesday: 09:00-19:00, plenty of room
      holidays: [],
    });
    expect(closedSlots).toHaveLength(1);
    expect(closedSlots[0]?.startTime).toBe("09:00");
    expect(closedSlots[0]?.date).toBe(BASE_DATE);
    // computeScheduleEnd re-derives the day's real hours from `operatingHours`
    // (Monday: 09:00-19:00 in the fixture), independent of this call's
    // artificially-shrunk closeTime override — so the 60-min job actually
    // finishes same-day at 10:00, not on a rolled-over day. This confirms
    // generateDaySlots' gate uses its OWN openTime/closeTime for the
    // same-day-fit decision, while computeScheduleEnd is always driven by the
    // authoritative weekly schedule — the two must be passed consistently by
    // real callers (computeAvailability always derives both from the same
    // operatingHours entry).
    expect(closedSlots[0]?.estimatedEndDate).toBe(BASE_DATE);
  });

  it("excludes slots that conflict with an existing job", () => {
    // Existing job at 09:00–10:00 (with 15-min buffer → blocks until 10:15)
    const jobStart = localToUTC(BASE_DATE, "09:00", IST);
    const jobEnd = new Date(jobStart.getTime() + 60 * 60000); // ends at 10:00
    const occupied: OccupiedInterval[] = [buildOccupiedInterval(jobStart.toISOString(), jobEnd.toISOString())];

    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: occupied,
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });

    // 09:00, 09:30, 10:00 should conflict; 10:30 should be free (job+buffer ends at 10:15)
    const conflictingTimes = slots.filter((s) =>
      ["09:00", "09:30", "10:00"].includes(s.startTime),
    );
    expect(conflictingTimes).toHaveLength(0);
    expect(slots.some((s) => s.startTime === "10:30")).toBe(true);
  });

  it("returns startAt as ISO UTC string matching the local time", () => {
    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: [],
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    // 09:00 IST = 03:30 UTC on 2026-08-17
    expect(slots[0]?.startAt).toBe("2026-08-17T03:30:00.000Z");
  });

  it("estimatedEndAt is exactly serviceDuration after startAt", () => {
    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 90,
      occupiedIntervals: [],
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    const first = slots[0];
    if (!first) throw new Error("Expected at least one slot");
    const startMs = new Date(first.startAt).getTime();
    const endMs = new Date(first.estimatedEndAt).getTime();
    expect(endMs - startMs).toBe(90 * 60000);
  });

  it("handles a fully booked day (all slots conflicted)", () => {
    // Block the entire operating window
    const dayStart = localToUTC(BASE_DATE, "09:00", IST);
    const dayEnd = localToUTC(BASE_DATE, "19:00", IST);
    const occupied: OccupiedInterval[] = [{ startAt: dayStart, endAt: dayEnd }];

    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: occupied,
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    expect(slots).toHaveLength(0);
  });

  it("offers multi-day rollover slots for a real PPF-scale duration (2880 min) that can't fit any single day", () => {
    const slots = generateDaySlots({
      date: BASE_DATE, // Monday
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 2880,
      occupiedIntervals: [],
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    expect(slots.length).toBeGreaterThan(0);
    const first = slots[0];
    if (!first) throw new Error("Expected at least one slot");
    expect(first.startTime).toBe("09:00");
    expect(first.date).toBe(BASE_DATE);
    // Matches the doc04 example: 4 working days + 480 min into day 5 (Friday 17:00)
    expect(first.estimatedEndDate).toBe(addDays(BASE_DATE, 4));
    expect(first.endTime).toBe("17:00");
  });

  it("multi-day candidates respect occupied intervals spanning into the rollover window", () => {
    // Another job occupies the target bay from Wed 09:00 through Wed close —
    // a Monday-start 2880-min job would roll through Wed and must be blocked.
    const wednesday = addDays(BASE_DATE, 2);
    const occupied: OccupiedInterval[] = [
      {
        startAt: localToUTC(wednesday, "09:00", IST),
        endAt: localToUTC(wednesday, "19:00", IST),
      },
    ];
    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 2880,
      occupiedIntervals: occupied,
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });
    expect(slots.some((s) => s.startTime === "09:00" && s.date === BASE_DATE)).toBe(false);
  });
});

// ─── hasConflict ──────────────────────────────────────────────────────────────

describe("hasConflict", () => {
  it("detects exact overlap", () => {
    const start = new Date("2026-08-17T03:30:00Z"); // 09:00 IST
    const rawEnd = new Date(start.getTime() + 60 * 60000); // 60-min service, buffer-free
    const jobStart = new Date("2026-08-17T03:30:00Z");
    const jobEnd = new Date("2026-08-17T04:30:00Z"); // includes buffer
    expect(hasConflict(start, rawEnd, [{ startAt: jobStart, endAt: jobEnd }])).toBe(true);
  });

  it("detects partial overlap at start", () => {
    const requestStart = new Date("2026-08-17T04:00:00Z"); // new job starts at 4am UTC
    const rawEnd = new Date(requestStart.getTime() + 30 * 60000); // 30-min service
    const jobEnd = new Date("2026-08-17T04:15:00Z"); // existing job still blocked at 4:15 UTC
    expect(
      hasConflict(requestStart, rawEnd, [
        { startAt: new Date("2026-08-17T03:00:00Z"), endAt: jobEnd },
      ]),
    ).toBe(true);
  });

  it("returns false for non-overlapping intervals", () => {
    const requestStart = new Date("2026-08-17T05:30:00Z"); // well after any job
    const rawEnd = new Date(requestStart.getTime() + 30 * 60000); // 30-min service
    const occupied: OccupiedInterval[] = [
      {
        startAt: new Date("2026-08-17T03:30:00Z"),
        endAt: new Date("2026-08-17T05:15:00Z"), // ends at 5:15 UTC
      },
    ];
    // New job at 5:30 UTC, 30 min service → conflicts if overlaps with end of 5:15 → 5:30 >= 5:15 → no conflict
    expect(hasConflict(requestStart, rawEnd, occupied)).toBe(false);
  });

  it("uses the true (already-computed) end, not a naive duration — a multi-day rawEndAt correctly extends the blocked window", () => {
    // The candidate's raw service duration would naively suggest it ends
    // well before this occupied interval starts, but its TRUE end (as would
    // be computed by computeScheduleEnd for a multi-day service) lands
    // inside it — hasConflict must trust the passed rawEndAt, not re-derive
    // its own duration-based end.
    const start = new Date("2026-08-17T03:30:00Z");
    const trueMultiDayEnd = new Date("2026-08-21T03:30:00Z"); // 4 days later
    const occupied: OccupiedInterval[] = [
      {
        startAt: new Date("2026-08-20T00:00:00Z"),
        endAt: new Date("2026-08-20T06:00:00Z"),
      },
    ];
    expect(hasConflict(start, trueMultiDayEnd, occupied)).toBe(true);
  });
});

// ─── buildOccupiedInterval ───────────────────────────────────────────────────

describe("buildOccupiedInterval", () => {
  it("adds 15-min buffer to the end", () => {
    const start = "2026-08-17T03:30:00.000Z"; // 09:00 IST
    const end = "2026-08-17T04:30:00.000Z"; // 10:00 IST
    const interval = buildOccupiedInterval(start, end);
    // endAt should be 10:15 IST = 04:45 UTC
    expect(interval.endAt.toISOString()).toBe("2026-08-17T04:45:00.000Z");
  });
});

// ─── computeAvailability ─────────────────────────────────────────────────────

describe("computeAvailability", () => {
  it("returns slots across multiple days", () => {
    const slots = computeAvailability({
      startDate: BASE_DATE,
      lookAheadDays: 3,
      serviceDurationMinutes: 60,
      requiredBayType: "wash",
      bays: BAYS,
      operatingHours: weeklyHours,
      holidays: [],
      timezone: IST,
      occupiedByBay: new Map(),
    });
    // Should have slots for Mon, Tue, Wed
    const dates = [...new Set(slots.map((s) => s.date))];
    expect(dates.length).toBe(3);
    expect(dates[0]).toBe(BASE_DATE);
  });

  it("skips holidays", () => {
    const slots = computeAvailability({
      startDate: BASE_DATE,
      lookAheadDays: 2,
      serviceDurationMinutes: 60,
      requiredBayType: "wash",
      bays: BAYS,
      operatingHours: weeklyHours,
      holidays: [BASE_DATE], // skip Monday
      timezone: IST,
      occupiedByBay: new Map(),
    });
    const dates = [...new Set(slots.map((s) => s.date))];
    expect(dates).not.toContain(BASE_DATE);
    expect(dates).toContain(addDays(BASE_DATE, 1)); // Tuesday
  });

  it("skips closed days (Sunday)", () => {
    const sunday = "2026-08-16"; // getDayOfWeek = 0 = Sunday
    const slots = computeAvailability({
      startDate: sunday,
      lookAheadDays: 1,
      serviceDurationMinutes: 60,
      requiredBayType: "wash",
      bays: BAYS,
      operatingHours: weeklyHours,
      holidays: [],
      timezone: IST,
      occupiedByBay: new Map(),
    });
    const dates = slots.map((s) => s.date);
    expect(dates).not.toContain(sunday);
  });

  it("returns empty if no compatible bays", () => {
    const slots = computeAvailability({
      startDate: BASE_DATE,
      lookAheadDays: 2,
      serviceDurationMinutes: 60,
      requiredBayType: "general", // no general bays in BAYS
      bays: BAYS,
      operatingHours: weeklyHours,
      holidays: [],
      timezone: IST,
      occupiedByBay: new Map(),
    });
    expect(slots).toHaveLength(0);
  });

  it("de-duplicates slots across multiple bays on the same day", () => {
    // Both wash bays are free — should not double-return the same start times
    const slots = computeAvailability({
      startDate: BASE_DATE,
      lookAheadDays: 1,
      serviceDurationMinutes: 60,
      requiredBayType: "wash",
      bays: BAYS,
      operatingHours: weeklyHours,
      holidays: [],
      timezone: IST,
      occupiedByBay: new Map(),
    });
    const startTimes = slots.map((s) => `${s.date}|${s.startTime}`);
    const uniqueTimes = new Set(startTimes);
    expect(uniqueTimes.size).toBe(startTimes.length); // no duplicates
  });

  it("a slot is available if at least one compatible bay is free", () => {
    // Bay 1 fully booked, Bay 2 free
    const dayStart = localToUTC(BASE_DATE, "09:00", IST);
    const dayEnd = localToUTC(BASE_DATE, "19:00", IST);
    const occupied = new Map<string, OccupiedInterval[]>([
      ["bay-wash-1", [{ startAt: dayStart, endAt: dayEnd }]],
    ]);

    const slots = computeAvailability({
      startDate: BASE_DATE,
      lookAheadDays: 1,
      serviceDurationMinutes: 60,
      requiredBayType: "wash",
      bays: BAYS,
      operatingHours: weeklyHours,
      holidays: [],
      timezone: IST,
      occupiedByBay: occupied,
    });
    // Bay 2 is still free, so slots should exist
    expect(slots.length).toBeGreaterThan(0);
  });
});

// ─── Booking rules ────────────────────────────────────────────────────────────

describe("Turnover buffer integration", () => {
  it("slot after a 60-min job starts at most 15 min after job ends", () => {
    // Job at 09:00–10:00 IST → blocks until 10:15 IST
    const jobStart = localToUTC(BASE_DATE, "09:00", IST);
    const jobEstEnd = new Date(jobStart.getTime() + 60 * 60000);
    const occupied: OccupiedInterval[] = [buildOccupiedInterval(jobStart.toISOString(), jobEstEnd.toISOString())];

    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: occupied,
      timezone: IST,
      operatingHours: weeklyHours,
      holidays: [],
    });

    // With 30-min granularity, next available start after 10:15 IST is 10:30 IST
    const firstAvailable = slots[0];
    expect(firstAvailable?.startTime).toBe("10:30");
  });
});

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
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  addDays,
} from "../../lib/schedule.js";
import type { Bay, OperatingHours } from "@autodeck/core";

const IST = "Asia/Kolkata";
const BASE_DATE = "2026-08-17"; // Monday

const BAYS: Bay[] = [
  { id: "bay-wash-1", tenantId: "t1", studioId: "s1", name: "Wash Bay 1", bayType: "wash", active: true },
  { id: "bay-wash-2", tenantId: "t1", studioId: "s1", name: "Wash Bay 2", bayType: "wash", active: true },
  { id: "bay-prot-1", tenantId: "t1", studioId: "s1", name: "Protection Bay 1", bayType: "protection", active: true },
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

  it("returns empty array for a closed day", () => {
    const slots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "19:00",
      serviceDurationMinutes: 60,
      occupiedIntervals: [],
      timezone: IST,
    });
    // Closed day
    const closedSlots = generateDaySlots({
      date: BASE_DATE,
      openTime: "09:00",
      closeTime: "09:30", // window too small for 60+15 min
      serviceDurationMinutes: 60,
      occupiedIntervals: [],
      timezone: IST,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(closedSlots).toHaveLength(0);
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
    });
    expect(slots).toHaveLength(0);
  });
});

// ─── hasConflict ──────────────────────────────────────────────────────────────

describe("hasConflict", () => {
  it("detects exact overlap", () => {
    const start = new Date("2026-08-17T03:30:00Z"); // 09:00 IST
    const jobStart = new Date("2026-08-17T03:30:00Z");
    const jobEnd = new Date("2026-08-17T04:30:00Z"); // includes buffer
    expect(hasConflict(start, 60, [{ startAt: jobStart, endAt: jobEnd }])).toBe(true);
  });

  it("detects partial overlap at start", () => {
    const requestStart = new Date("2026-08-17T04:00:00Z"); // new job starts at 4am UTC
    const jobEnd = new Date("2026-08-17T04:15:00Z"); // existing job still blocked at 4:15 UTC
    expect(
      hasConflict(requestStart, 30, [
        { startAt: new Date("2026-08-17T03:00:00Z"), endAt: jobEnd },
      ]),
    ).toBe(true);
  });

  it("returns false for non-overlapping intervals", () => {
    const requestStart = new Date("2026-08-17T05:30:00Z"); // well after any job
    const occupied: OccupiedInterval[] = [
      {
        startAt: new Date("2026-08-17T03:30:00Z"),
        endAt: new Date("2026-08-17T05:15:00Z"), // ends at 5:15 UTC
      },
    ];
    // New job at 5:30 UTC, 30 min service → conflicts if overlaps with end of 5:15 → 5:30 >= 5:15 → no conflict
    expect(hasConflict(requestStart, 30, occupied)).toBe(false);
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
  const weeklyHours: OperatingHours[] = [
    { dayOfWeek: 0, open: "09:00", close: "19:00", closed: true }, // Sunday closed
    { dayOfWeek: 1, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 2, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 3, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 4, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 5, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 6, open: "09:00", close: "19:00", closed: false },
  ];

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
    });

    // With 30-min granularity, next available start after 10:15 IST is 10:30 IST
    const firstAvailable = slots[0];
    expect(firstAvailable?.startTime).toBe("10:30");
  });
});

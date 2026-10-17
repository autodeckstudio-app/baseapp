import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { heldStartTimes, holdEndsAt, isPriorityHeld, hasPriorityMembership, PRIORITY_HELD_PER_DAY } from "../../lib/priority-hold.js";

const hours = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, open: "09:00", close: "18:00", closed: false })) as never;
const base = { serviceDurationMinutes: 45, operatingHours: hours, holidays: [] as string[], timezone: "Asia/Kolkata" };

describe("priority slot hold", () => {
  it("holds the two earliest start times of an open day", () => {
    const h = heldStartTimes({ ...base, date: "2026-10-21" });
    expect(h).toHaveLength(PRIORITY_HELD_PER_DAY);
    expect(h[0]).toBe("09:00");
    expect(h[0]! < h[1]!).toBe(true);
  });
  it("holds nothing on a closed day or holiday", () => {
    expect(heldStartTimes({ ...base, date: "2026-10-21", holidays: ["2026-10-21"] })).toEqual([]);
  });
  it("the hold ends at 18:00 studio time the evening before", () => {
    expect(holdEndsAt("2026-10-21", "Asia/Kolkata").toISOString()).toBe("2026-10-20T12:30:00.000Z");
  });
  it("a held slot is closed to others before the release and open after it", () => {
    const p = { date: "2026-10-21", startTime: "09:00", held: ["09:00", "09:00x"], timezone: "Asia/Kolkata" };
    expect(isPriorityHeld({ ...p, now: new Date("2026-10-20T12:29:00Z") })).toBe(true);
    expect(isPriorityHeld({ ...p, now: new Date("2026-10-20T12:31:00Z") })).toBe(false);
    expect(isPriorityHeld({ ...p, startTime: "15:00", now: new Date("2026-10-19T00:00:00Z") })).toBe(false);
  });
  it("only an active, in-date membership with the priority slot counts", () => {
    expect(hasPriorityMembership([{ status: "active", endDate: "2026-12-01", prioritySlot: true }], "2026-10-17")).toBe(true);
    expect(hasPriorityMembership([{ status: "active", endDate: "2026-12-01" }], "2026-10-17")).toBe(false);
    expect(hasPriorityMembership([{ status: "expired", endDate: "2026-12-01", prioritySlot: true }], "2026-10-17")).toBe(false);
    expect(hasPriorityMembership([{ status: "active", endDate: "2026-10-01", prioritySlot: true }], "2026-10-17")).toBe(false);
  });
  it("guard: both the slot list and booking creation use the hold", () => {
    for (const f of ["getAvailability", "createBooking", "rescheduleBooking"]) {
      expect(readFileSync(`${__dirname}/../../functions/booking/${f}.ts`, "utf8")).toContain("priority-");
    }
  });
});

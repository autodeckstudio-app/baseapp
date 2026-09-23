import { describe, expect, it } from "vitest";
import { formatDayLong, formatTime, shiftDay, studioToday } from "./format";

describe("studio-day helpers", () => {
  it("shifts across month ends", () => {
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("uses the studio timezone for today", () => {
    // 20:00 UTC on the 23rd is 01:30 IST on the 24th.
    expect(studioToday(new Date("2026-09-23T20:00:00Z"))).toBe("2026-09-24");
  });
  it("formats day and time for people", () => {
    expect(formatDayLong("2026-09-23")).toContain("Wednesday");
    expect(formatTime("2026-09-23T05:00:00Z")).toBe("10:30 am");
  });
});

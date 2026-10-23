import { describe, expect, it } from "vitest";
import { formatDuration, formatDurationWithDays, formatServiceTime } from "./duration";
describe("formatDuration", () => {
  it("under 60 minutes", () => { expect(formatDuration(45)).toBe("45 mins"); expect(formatDuration(1)).toBe("1 min"); expect(formatDuration(0)).toBe("0 mins"); });
  it("exact hours", () => { expect(formatDuration(60)).toBe("1 hr"); expect(formatDuration(360)).toBe("6 hr"); });
  it("hours and minutes", () => { expect(formatDuration(405)).toBe("6 hr 45 mins"); expect(formatDuration(61)).toBe("1 hr 1 min"); expect(formatDuration(90)).toBe("1 hr 30 mins"); });
  it("keeps the existing day wording from 8 hours up on catalogue cards", () => {
    expect(formatDurationWithDays(405)).toBe("6 hr 45 mins"); expect(formatDurationWithDays(480)).toBe("1 day"); expect(formatDurationWithDays(960)).toBe("2 days");
  });
  it("keeps the ~ prefix and the multi-day service-time wording", () => {
    expect(formatServiceTime(405)).toBe("~6 hr 45 mins"); expect(formatServiceTime(45)).toBe("~45 mins"); expect(formatServiceTime(4320)).toBe("~72 hrs of service time");
  });
});

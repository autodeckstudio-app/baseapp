import { describe, expect, it } from "vitest";
import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it("short durations stay in minutes", () => {
    expect(formatDuration(0)).toBe("0 mins");
    expect(formatDuration(1)).toBe("1 min");
    expect(formatDuration(45)).toBe("45 mins");
    expect(formatDuration(59)).toBe("59 mins");
  });
  it("whole and part hours", () => {
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("1 hr 30 mins");
    expect(formatDuration(61)).toBe("1 hr 1 min");
    expect(formatDuration(180)).toBe("3 hr");
    expect(formatDuration(1500)).toBe("25 hr");
  });
  it("rounds and clamps", () => {
    expect(formatDuration(59.6)).toBe("1 hr");
    expect(formatDuration(-5)).toBe("0 mins");
  });
});

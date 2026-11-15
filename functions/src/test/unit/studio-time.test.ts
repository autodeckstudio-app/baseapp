import { describe, expect, it } from "vitest";
import { studioLocalToIso } from "../../lib/studio-time.js";

describe("studioLocalToIso", () => {
  it("converts Asia/Kolkata wall time to the correct UTC instant", () => {
    expect(studioLocalToIso("2026-10-10 15:30", "Asia/Kolkata", "Agreed pickup time")).toBe("2026-10-10T10:00:00.000Z");
  });

  it("accepts the datetime-local T separator", () => {
    expect(studioLocalToIso("2026-10-10T09:05", "Asia/Kolkata", "Agreed dropoff time")).toBe("2026-10-10T03:35:00.000Z");
  });

  it("converts a non-IST studio timezone correctly", () => {
    expect(studioLocalToIso("2026-01-15 10:00", "America/New_York", "Agreed pickup time")).toBe("2026-01-15T15:00:00.000Z");
  });

  it("rejects malformed input with an invalid-argument error", () => {
    expect(() => studioLocalToIso("tomorrow evening", "Asia/Kolkata", "Agreed pickup time")).toThrowError(/YYYY-MM-DD HH:mm/);
  });

  it("rejects impossible dates", () => {
    expect(() => studioLocalToIso("2026-13-40 25:70", "Asia/Kolkata", "Agreed pickup time")).toThrowError(/not a valid date and time/);
  });
});

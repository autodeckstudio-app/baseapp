import { describe, it, expect } from "vitest";
import { nextDue, dueLine } from "./car-next-due";
describe("car next due", () => {
  const today = "2026-10-17";
  it("picks the soonest expiry still ahead", () => {
    const d = nextDue([{ label: "Insurance", date: "2026-12-01" }, { label: "PUC", date: "2026-10-30" }, { label: "RC", date: null }], today);
    expect(d).toEqual({ label: "PUC", date: "2026-10-30", days: 13 });
  });
  it("ignores items already past or without a date", () => {
    expect(nextDue([{ label: "PUC", date: "2026-09-01" }, { label: "RC", date: undefined }], today)).toBeNull();
  });
  it("accepts ISO timestamps", () => expect(nextDue([{ label: "W", date: "2026-10-18T10:00:00Z" }], today)?.days).toBe(1));
  it("words it", () => {
    expect(dueLine({ label: "x", date: "d", days: 0 })).toBe("Today");
    expect(dueLine({ label: "x", date: "d", days: 1 })).toBe("Tomorrow");
    expect(dueLine({ label: "x", date: "d", days: 9 })).toBe("In 9 days");
  });
});

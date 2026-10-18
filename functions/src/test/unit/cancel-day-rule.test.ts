import { describe, expect, it } from "vitest";
import { isCancellableDay, SAME_DAY_MESSAGE } from "../../functions/booking/adminCancelBooking.js";

describe("customer cancel is for later days only (owner, 18 Oct 9:41 PM)", () => {
  const now = Date.parse("2026-10-19T05:00:00Z"); // 10:30 AM IST on 19 Oct
  it("same day is refused, tomorrow and later are allowed", () => {
    expect(isCancellableDay("2026-10-19", now)).toBe(false);
    expect(isCancellableDay("2026-10-20", now)).toBe(true);
    expect(isCancellableDay("2026-10-18", now)).toBe(false);
  });
  it("uses the India date, not UTC", () => {
    const lateIst = Date.parse("2026-10-19T19:00:00Z"); // 12:30 AM IST on 20 Oct
    expect(isCancellableDay("2026-10-20", lateIst)).toBe(false);
    expect(isCancellableDay("2026-10-21", lateIst)).toBe(true);
  });
  it("the message names the way out and has no em dash", () => {
    expect(SAME_DAY_MESSAGE).toContain("call the studio");
    expect(SAME_DAY_MESSAGE).not.toContain("\u2014");
  });
});

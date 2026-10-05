import { describe, expect, it } from "vitest";
import { isBookingMissed } from "./constants.js";

describe("isBookingMissed", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  it("is missed only after the grace window for open bookings", () => {
    expect(isBookingMissed({ status: "CONFIRMED", scheduledAt: "2026-10-05T07:00:00Z" }, now)).toBe(true);
    expect(isBookingMissed({ status: "PENDING", scheduledAt: "2026-10-05T07:00:00Z" }, now)).toBe(true);
    expect(isBookingMissed({ status: "CONFIRMED", scheduledAt: "2026-10-05T10:00:00Z" }, now)).toBe(false);
    expect(isBookingMissed({ status: "CONFIRMED", scheduledAt: "2026-10-06T10:00:00Z" }, now)).toBe(false);
  });
  it("never applies to other statuses", () => {
    for (const status of ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]) {
      expect(isBookingMissed({ status, scheduledAt: "2026-10-01T07:00:00Z" }, now)).toBe(false);
    }
  });
});

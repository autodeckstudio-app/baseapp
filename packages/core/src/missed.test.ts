import { describe, expect, it } from "vitest";
import { bookingMissedAt, isBookingMissed, isBookingLateToday } from "./constants.js";

const booking = { status: "CONFIRMED", scheduledAt: "2026-10-05T04:30:00Z" };
describe("booking close cutoff", () => {
  it("keeps a morning booking valid until exactly 9pm IST", () => {
    expect(bookingMissedAt(booking.scheduledAt)).toBe(Date.parse("2026-10-05T15:30:00Z"));
    expect(isBookingMissed(booking, Date.parse("2026-10-05T15:29:59Z"))).toBe(false);
    expect(isBookingLateToday(booking, Date.parse("2026-10-05T15:29:59Z"))).toBe(true);
    expect(isBookingMissed(booking, Date.parse("2026-10-05T15:30:00Z"))).toBe(true);
    expect(isBookingLateToday(booking, Date.parse("2026-10-05T15:30:00Z"))).toBe(false);
  });
  it("uses the Indian calendar day across UTC midnight", () => {
    expect(bookingMissedAt("2026-10-04T19:00:00Z")).toBe(Date.parse("2026-10-05T15:30:00Z"));
  });
  it("uses 7pm on Sunday, not 9pm", () => {
    const sunday = { ...booking, scheduledAt: "2026-10-11T04:30:00Z" };
    expect(isBookingMissed(sunday, Date.parse("2026-10-11T13:29:59Z"))).toBe(false);
    expect(isBookingMissed(sunday, Date.parse("2026-10-11T13:30:00Z"))).toBe(true);
  });
  it("excludes future and invalid bookings", () => {
    expect(isBookingMissed(booking, Date.parse("2026-10-04T16:00:00Z"))).toBe(false);
    expect(isBookingMissed({ ...booking, scheduledAt: "bad" })).toBe(false);
  });
  it("never marks arrived or closed bookings missed", () => {
    expect(isBookingMissed({ ...booking, standbyArrivedAt: "2026-10-05T06:00:00Z" }, Date.parse("2026-10-06T16:00:00Z"))).toBe(false);
    for (const status of ["ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"]) {
      expect(isBookingMissed({ ...booking, status }, Date.parse("2026-10-06T16:00:00Z"))).toBe(false);
    }
  });
});

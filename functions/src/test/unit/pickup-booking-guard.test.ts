import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickupBlockedByBooking } from "../../lib/pickup-booking-guard";

describe("pickup request vs booking status (server guard)", () => {
  it("blocks approve/mark-done once the booking is cancelled or expired", () => {
    expect(pickupBlockedByBooking("CANCELLED")).toBe(true);
    expect(pickupBlockedByBooking("EXPIRED")).toBe(true);
    expect(pickupBlockedByBooking("NO_SHOW")).toBe(true);
  });
  it("does not block live or finished bookings", () => {
    for (const s of ["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED"]) expect(pickupBlockedByBooking(s)).toBe(false);
  });
  it("blocks when the booking is missing (orphan request)", () => {
    expect(pickupBlockedByBooking(undefined)).toBe(true);
  });
  it("updatePickupRequest applies the guard to CONFIRMED and DONE only, so DECLINED can still close a stale request", () => {
    const src = readFileSync(join(__dirname, "../../functions/booking/pickupRequests.ts"), "utf8");
    expect(src).toMatch(/data\.status === "CONFIRMED" \|\| data\.status === "DONE"\) && cur\.bookingId[\s\S]{0,400}pickupBlockedByBooking\(bk\?\.status\)/);
  });
});

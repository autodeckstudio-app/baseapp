import { describe, expect, it } from "vitest";
import type { Booking } from "@autodeck/core";
import { rescheduleEntry } from "./booking-rules";

const future = new Date(Date.now() + 72 * 3600_000).toISOString();
const base = { status: "CONFIRMED", scheduledAt: future } as unknown as Booking;

describe("rescheduleEntry (premium request flow, preview)", () => {
  it("washes and non-premium categories use the direct path", () => {
    // Premium band = pay-at-studio groups (coatings/ppf/garage/mods); tinting is
    // in mods, so it is premium - only washing and pickup stay direct.
    expect(rescheduleEntry(base, "washing")).toEqual({ mode: "direct" });
    expect(rescheduleEntry(base, "pickup")).toEqual({ mode: "direct" });
    expect(rescheduleEntry(base, null)).toEqual({ mode: "direct" });
    expect(rescheduleEntry(base, "tinting")).toEqual({ mode: "request" });
  });
  it("premium with no request yet offers the request flow", () => {
    expect(rescheduleEntry(base, "ceramic")).toEqual({ mode: "request" });
  });
  it("a pending request shows its requested slot, not a button", () => {
    const b = { ...base, rescheduleRequest: { status: "pending", requestedDate: "2026-11-10", requestedTime: "14:00", baseScheduledAt: future, requestedAt: future, idempotencyKey: "k" }, rescheduleRequestCount: 1 } as Booking;
    expect(rescheduleEntry(b, "ceramic")).toEqual({ mode: "request-pending", requestedDate: "2026-11-10", requestedTime: "14:00" });
  });
  it("a used request (declined or approved) blocks re-requesting", () => {
    const b = { ...base, rescheduleRequest: { status: "declined", requestedDate: "2026-11-10", requestedTime: "14:00", baseScheduledAt: future, requestedAt: future, idempotencyKey: "k" }, rescheduleRequestCount: 1 } as Booking;
    expect(rescheduleEntry(b, "ppf")).toEqual({ mode: "request-used" });
  });
  it("non-CONFIRMED premium bookings get no online path", () => {
    const b = { ...base, status: "CANCELLED" } as Booking;
    expect(rescheduleEntry(b, "ceramic").mode).toBe("none");
  });
  it("undefined category is a loading state, not the legacy path", () => {
    expect(rescheduleEntry(base, undefined)).toEqual({ mode: "loading" });
    expect(rescheduleEntry(base, null)).toEqual({ mode: "direct" }); // definitively unknown -> legacy
  });
  it("missed premium bookings follow the disclosed existing policy (contact studio), flagged UI/server inconsistency NOT silently resolved", () => {
    // Missed = past the scheduled day's studio close (19:00 Sun / 21:00 other days IST).
    const yesterday = new Date(Date.now() - 86400000);
    yesterday.setUTCHours(4, 30, 0, 0); // 10:00 IST yesterday
    const missed = { ...base, status: "CONFIRMED", scheduledAt: yesterday.toISOString() } as unknown as Booking;
    expect(rescheduleEntry(missed, "ceramic").mode).toBe("none");
  });
});

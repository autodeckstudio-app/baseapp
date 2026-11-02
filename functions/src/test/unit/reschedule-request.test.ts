import { describe, expect, it } from "vitest";
import { canRequestReschedule, canDecideRescheduleRequest, isPremiumCategory, PREMIUM_REQUEST_CUTOFF_HOURS } from "../../lib/reschedule-request.js";

const NOW = new Date("2026-11-02T10:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();
const confirmed = (over: Record<string, unknown> = {}) => ({ status: "CONFIRMED", scheduledAt: hoursFromNow(72), ...over });

describe("isPremiumCategory", () => {
  it("matches the pay-at-studio band, not washes", () => {
    expect(isPremiumCategory("ceramic")).toBe(true);
    expect(isPremiumCategory("ppf")).toBe(true);
    expect(isPremiumCategory("washing")).toBe(false);
  });
});

describe("canRequestReschedule", () => {
  it("allows a premium booking well ahead of the appointment", () => {
    expect(canRequestReschedule(confirmed(), "ceramic", NOW)).toEqual({ ok: true });
  });
  it("rejects non-premium categories (they keep direct reschedule)", () => {
    const r = canRequestReschedule(confirmed(), "washing", NOW);
    expect(r.ok).toBe(false);
  });
  it("rejects inside the 24h cutoff measured from the current appointment", () => {
    const r = canRequestReschedule(confirmed({ scheduledAt: hoursFromNow(PREMIUM_REQUEST_CUTOFF_HOURS - 1) }), "ceramic", NOW);
    expect(r).toMatchObject({ ok: false, code: "failed-precondition" });
  });
  it("rejects a second request while one is pending (simultaneous/repeat guard)", () => {
    const b = confirmed({ rescheduleRequest: { status: "pending", baseScheduledAt: hoursFromNow(72) } });
    expect(canRequestReschedule(b, "ceramic", NOW)).toMatchObject({ ok: false, code: "already-exists" });
  });
  it("rejects a fresh request after a declined one (one request per booking; decline-retry is a flagged open policy question)", () => {
    const b = confirmed({ rescheduleRequest: { status: "declined", baseScheduledAt: hoursFromNow(72) }, rescheduleRequestCount: 1 });
    expect(canRequestReschedule(b, "ceramic", NOW)).toMatchObject({ ok: false, code: "failed-precondition" });
  });
  it("rejects a fresh request after an approved one (the move already happened)", () => {
    const b = confirmed({ rescheduleRequest: { status: "approved", baseScheduledAt: hoursFromNow(72) }, rescheduleRequestCount: 1 });
    expect(canRequestReschedule(b, "ceramic", NOW)).toMatchObject({ ok: false, code: "failed-precondition" });
  });
  it("treats an absent counter as zero (pre-feature bookings)", () => {
    expect(canRequestReschedule(confirmed({ rescheduleRequestCount: undefined }), "ceramic", NOW)).toEqual({ ok: true });
  });
  it("rejects non-CONFIRMED bookings", () => {
    expect(canRequestReschedule(confirmed({ status: "CANCELLED" }), "ceramic", NOW)).toMatchObject({ ok: false, code: "failed-precondition" });
  });
});

describe("canDecideRescheduleRequest", () => {
  const req = { status: "pending", baseScheduledAt: hoursFromNow(72) };
  it("allows deciding a pending request on an unchanged booking", () => {
    expect(canDecideRescheduleRequest(confirmed(), req)).toEqual({ ok: true });
  });
  it("rejects a stale approval when the booking moved since the request", () => {
    expect(canDecideRescheduleRequest(confirmed({ scheduledAt: hoursFromNow(96) }), req)).toMatchObject({ ok: false, code: "failed-precondition" });
  });
  it("rejects when the booking is no longer confirmed", () => {
    expect(canDecideRescheduleRequest(confirmed({ status: "CANCELLED" }), req)).toMatchObject({ ok: false, code: "failed-precondition" });
  });
  it("rejects re-deciding a terminal request", () => {
    expect(canDecideRescheduleRequest(confirmed(), { ...req, status: "approved" })).toMatchObject({ ok: false, code: "failed-precondition" });
  });
});

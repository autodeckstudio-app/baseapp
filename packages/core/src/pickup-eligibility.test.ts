import { describe, it, expect } from "vitest";
import { pickupEligibility } from "./pickup-eligibility";

const req = (kind: string, status = "REQUESTED", p: string | null = null, d: string | null = null) => ({ kind, status, pickupCompletedAt: p, dropCompletedAt: d });
const T = "2026-10-26T04:30:00Z";

describe("pickupEligibility matrix (Admin and Studio share it)", () => {
  it("live bookings are actionable", () => {
    for (const b of ["PENDING", "CONFIRMED", "ACTIVE"]) expect(pickupEligibility(req("both"), b).actionable).toBe(true);
  });
  it("cancelled, expired, no-show and missing bookings are never actionable, even with a leg still owed", () => {
    for (const b of ["CANCELLED", "EXPIRED", "NO_SHOW", null, undefined]) {
      expect(pickupEligibility(req("both", "CONFIRMED", T, null), b).actionable).toBe(false);
      expect(pickupEligibility(req("drop"), b).note).toMatch(/Decline/);
    }
  });
  it("COMPLETED booking: a drop still owed stays actionable (both with pickup done, drop-only)", () => {
    expect(pickupEligibility(req("both", "CONFIRMED", T, null), "COMPLETED").actionable).toBe(true);
    expect(pickupEligibility(req("drop", "REQUESTED"), "COMPLETED").actionable).toBe(true);
    expect(pickupEligibility(req("both", "REQUESTED"), "COMPLETED").actionable).toBe(true);
  });
  it("COMPLETED booking: all legs done and CONFIRMED can still be closed", () => {
    expect(pickupEligibility(req("both", "CONFIRMED", T, T), "COMPLETED").actionable).toBe(true);
    expect(pickupEligibility(req("pickup", "CONFIRMED", T, null), "COMPLETED").actionable).toBe(true);
  });
  it("COMPLETED booking: pickup-only not started is stale", () => {
    expect(pickupEligibility(req("pickup", "REQUESTED"), "COMPLETED").actionable).toBe(false);
    expect(pickupEligibility(req("pickup", "CONFIRMED"), "COMPLETED").actionable).toBe(false);
  });
  it("closed requests are not actionable or flagged", () => {
    expect(pickupEligibility(req("drop", "DONE"), "CANCELLED")).toEqual({ actionable: false, note: null });
    expect(pickupEligibility(req("drop", "DECLINED"), null)).toEqual({ actionable: false, note: null });
  });
});

import { describe, expect, it } from "vitest";
import { evaluateWash, pickWash, todayInIndia } from "./membership-wash";

const plan = { id: "m1", status: "active" as const, washesTotal: 4, washesUsed: 1, startDate: "2026-10-01", endDate: "2026-11-01" };
const wash = { membershipWashEligible: true };
const today = "2026-10-16";

describe("membership wash rules", () => {
  it("offers a wash on an active, in-date plan with washes left for an eligible service", () => {
    expect(evaluateWash({ membership: plan, service: wash, today })).toEqual({ ok: true, membershipId: "m1", washesLeft: 3, expiresOn: "2026-11-01" });
  });
  it("refuses when there is no plan", () => {
    expect(evaluateWash({ membership: null, service: wash, today })).toEqual({ ok: false, reason: "no_membership" });
  });
  it("refuses a plan that is not active (pending, expired, cancelled)", () => {
    for (const status of ["pending", "expired", "cancelled"] as const) {
      expect(evaluateWash({ membership: { ...plan, status }, service: wash, today })).toEqual({ ok: false, reason: "not_active" });
    }
  });
  it("refuses before the start date and after the end date, but allows the last day", () => {
    expect(evaluateWash({ membership: { ...plan, startDate: "2026-10-17" }, service: wash, today })).toEqual({ ok: false, reason: "not_started" });
    expect(evaluateWash({ membership: { ...plan, endDate: "2026-10-15" }, service: wash, today })).toEqual({ ok: false, reason: "expired" });
    expect(evaluateWash({ membership: { ...plan, endDate: "2026-10-16" }, service: wash, today }).ok).toBe(true);
  });
  it("refuses when every included wash is used", () => {
    expect(evaluateWash({ membership: { ...plan, washesUsed: 4 }, service: wash, today })).toEqual({ ok: false, reason: "no_washes_left" });
    expect(evaluateWash({ membership: { ...plan, washesUsed: 9 }, service: wash, today })).toEqual({ ok: false, reason: "no_washes_left" });
  });
  it("refuses services that are not wash-eligible", () => {
    expect(evaluateWash({ membership: plan, service: { membershipWashEligible: false }, today })).toEqual({ ok: false, reason: "service_not_eligible" });
    expect(evaluateWash({ membership: plan, service: null, today })).toEqual({ ok: false, reason: "service_not_eligible" });
  });
  it("never lets a booking redeem twice", () => {
    expect(evaluateWash({ membership: plan, service: wash, today, alreadyApplied: true })).toEqual({ ok: false, reason: "already_applied" });
  });
  it("picks the plan with the most washes left", () => {
    const d = pickWash([plan, { ...plan, id: "m2", washesUsed: 0 }], wash, today);
    expect(d).toMatchObject({ ok: true, membershipId: "m2", washesLeft: 4 });
  });
  it("reports the first reason when no plan works", () => {
    expect(pickWash([{ ...plan, status: "expired" }], wash, today)).toEqual({ ok: false, reason: "not_active" });
    expect(pickWash([], wash, today)).toEqual({ ok: false, reason: "no_membership" });
  });
  it("uses the India calendar date", () => {
    expect(todayInIndia(new Date("2026-10-15T20:00:00Z"))).toBe("2026-10-16");
  });
});

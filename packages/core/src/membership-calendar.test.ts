import { afterEach, describe, expect, it, vi } from "vitest";
import { membershipDay, membershipTermDates } from "./membership-calendar.js";
import { getEffectiveMembershipStatus } from "./membership-status.js";
import { MEMBERSHIP_DURATION_DAYS } from "./constants.js";
afterEach(() => vi.useRealTimers());
describe("membership inclusive IST calendar", () => {
  it.each([
    ["2026-11-20T18:29:59.999Z", "2026-11-20", "active"],
    ["2026-11-20T18:30:00.000Z", "2026-11-21", "expired"],
    ["2026-11-20T23:59:59.999Z", "2026-11-21", "expired"],
    ["2026-11-21T00:00:00.000Z", "2026-11-21", "expired"],
    ["2026-11-19T18:30:00.000Z", "2026-11-20", "active"],
  ])("at %s day=%s and status=%s", (now, day, status) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now));
    const m = Object.freeze({ status: "active" as const, endDate: "2026-11-20" });
    expect(membershipDay()).toBe(day);
    expect(getEffectiveMembershipStatus(m)).toBe(status);
    expect(m.status).toBe("active"); expect(m.endDate).toBe("2026-11-20");
  });
  it.each(["pending", "cancelled", "expired"] as const)("never reactivates %s", status => {
    expect(getEffectiveMembershipStatus({ status, endDate: "2099-01-01" })).toBe(status);
  });
  it("keeps date-only parameters as calendar dates", () => expect(membershipDay("2026-11-20")).toBe("2026-11-20"));
  it("anchors new activations to IST while retaining the exact existing duration offset", () => {
    expect(MEMBERSHIP_DURATION_DAYS).toBe(30);
    expect(membershipTermDates("2026-11-20T18:29:59Z", MEMBERSHIP_DURATION_DAYS)).toEqual({startDate:"2026-11-20",endDate:"2026-12-20"});
    expect(membershipTermDates("2026-11-20T18:30:00Z", MEMBERSHIP_DURATION_DAYS)).toEqual({startDate:"2026-11-21",endDate:"2026-12-21"});
    expect(membershipTermDates("2028-02-28T18:30:00Z", 1)).toEqual({startDate:"2028-02-29",endDate:"2028-03-01"});
  });
});

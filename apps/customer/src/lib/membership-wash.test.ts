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

import { readFileSync } from "node:fs";
import { daysLeft, cardState, valueRedeemed, compareCols } from "./membership-view";
import { carryOverLine } from "./membership-rules";

describe("membership hub rules", () => {
  it("days left counts calendar days in India", () => {
    expect(daysLeft("2026-10-23T00:00:00.000Z", "2026-10-16")).toBe(7);
    expect(daysLeft(null, "2026-10-16")).toBeNull();
    expect(cardState({ status: "active", washesTotal: 4, washesUsed: 1, endDate: "2026-10-15" }, "2026-10-16").ended).toBe(true);
    expect(cardState({ status: "active", washesTotal: 4, washesUsed: 9, endDate: null }, "2026-10-16").left).toBe(0);
  });
  it("value used keeps washes and discounts apart and ignores bad numbers", () => {
    expect(valueRedeemed([{ usageType: "wash", valueRedeemed: 100000 }, { usageType: "discount", valueRedeemed: 5000 }, { usageType: "discount", valueRedeemed: NaN }])).toEqual({ total: 105000, washes: 1, washValue: 100000, discountValue: 5000 });
  });
  it("compare marks best value only when rates differ", () => {
    const p = (id: string, price: number, w: number) => ({ id, priceInPaise: price, includedWashes: w, discountPercent: 10, name: id, active: true }) as never;
    expect(compareCols([p("a", 360000, 4), p("b", 680000, 8)], "a").map((c) => [c.best, c.current])).toEqual([[false, true], [true, false]]);
    expect(compareCols([p("a", 400000, 4), p("b", 800000, 8)], null).some((c) => c.best)).toBe(false);
  });
  it("the carry-over words come from one setting and no screen states the rule itself", () => {
    expect(carryOverLine("expire")).toBe("Unused washes do not roll over.");
    expect(carryOverLine(null)).toBeNull();
    for (const f of ["src/app/(tabs)/membership/[planId].tsx", "src/app/(tabs)/membership/index.tsx", "src/ui/MembershipCard.tsx"]) expect(readFileSync(f, "utf8")).not.toMatch(/roll over|do not roll|carry over/i);
  });
  it("membership card is used on the hub only; the current route just redirects; Home does not repeat it", () => {
    expect(readFileSync("src/app/(tabs)/membership/current.tsx", "utf8")).toContain("Redirect");
    const users = ["src/app/(tabs)/index.tsx", "src/ui/HomeView.tsx", "src/app/(tabs)/profile/index.tsx"].filter((f) => { try { return readFileSync(f, "utf8").includes("MembershipCard"); } catch { return false; } });
    expect(users).toEqual([]);
  });
  it("the book-with-membership button is gated on the dark flag", () => {
    expect(readFileSync("src/app/(tabs)/membership/index.tsx", "utf8")).toMatch(/MEMBERSHIP_WASH_LIVE && washIds/);
  });
});

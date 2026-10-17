import { describe, expect, it } from "vitest";
import { memberSaving } from "./member-save";

const plans = [
  { priceInPaise: 180000, includedWashes: 2, active: true },
  { priceInPaise: 900000, includedWashes: 10, active: true },
];
const wash = { membershipWashEligible: true, priceOnRequest: false } as const;

describe("members save line", () => {
  it("is total minus the cheapest included-wash rate", () => {
    expect(memberSaving({ service: wash, total: 112500, plans })).toBe(22500);
  });
  it("is hidden when there is nothing to save", () => {
    expect(memberSaving({ service: wash, total: 90000, plans })).toBeNull();
    expect(memberSaving({ service: wash, total: 80000, plans })).toBeNull();
  });
  it("is hidden without real data", () => {
    expect(memberSaving({ service: wash, total: 112500, plans: [] })).toBeNull();
    expect(memberSaving({ service: wash, total: 112500, plans: null })).toBeNull();
    expect(memberSaving({ service: wash, total: null, plans })).toBeNull();
    expect(memberSaving({ service: { membershipWashEligible: false }, total: 112500, plans })).toBeNull();
    expect(memberSaving({ service: { membershipWashEligible: true, priceOnRequest: true }, total: 112500, plans })).toBeNull();
    expect(memberSaving({ service: wash, total: 112500, plans: [{ priceInPaise: 0, includedWashes: 2, active: true }] })).toBeNull();
    expect(memberSaving({ service: wash, total: 112500, plans: [{ priceInPaise: 1000, includedWashes: 1, active: false }] })).toBeNull();
  });
});

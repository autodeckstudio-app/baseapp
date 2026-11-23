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
  it("a bound plan quotes a saving only for its snapshotted services", () => {
    const bound = [{ priceInPaise: 180000, includedWashes: 2, active: true, washServiceIds: ["svc-regular-wash"] }];
    expect(memberSaving({ service: { id: "svc-regular-wash", membershipWashEligible: false }, total: 112500, plans: bound })).toBe(22500);
    expect(memberSaving({ service: { id: "svc-wash-and-wax", membershipWashEligible: true }, total: 112500, plans: bound })).toBeNull();
  });
  it("unbound plans keep the legacy global-flag rule alongside bound ones", () => {
    const mixed = [
      { priceInPaise: 180000, includedWashes: 2, active: true, washServiceIds: ["svc-regular-wash"] },
      { priceInPaise: 900000, includedWashes: 10, active: true },
    ];
    expect(memberSaving({ service: { id: "svc-wash-and-wax", membershipWashEligible: true }, total: 112500, plans: mixed })).toBe(22500);
    expect(memberSaving({ service: { id: "svc-other", membershipWashEligible: false }, total: 112500, plans: mixed })).toBeNull();
  });
});

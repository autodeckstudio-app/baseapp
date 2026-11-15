import { describe, it, expect } from "vitest";
import { membershipCoveredLabel } from "./settlement-display";
describe("membership coverage labels", () => {
  it("never describes settled coverage as money", () =>
    expect(membershipCoveredLabel({ settlementKind: "membership_covered" })).toBe(
      "Membership-covered",
    ));
  it("labels pending only consumed wash zero", () => {
    expect(membershipCoveredLabel({ membershipWashUsed: true, totalAmount: 0 })).toBe(
      "Membership-covered, not yet settled",
    );
    for (const v of [{}, { membershipWashUsed: true, totalAmount: 100 }, { totalAmount: 0 }])
      expect(membershipCoveredLabel(v)).toBeNull();
  });
});

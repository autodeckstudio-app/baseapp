import { describe, expect, it } from "vitest";
import { membershipCoveredLabel } from "./membership-covered-label";
describe("membershipCoveredLabel", () => {
  it("settled covered visit", () => {
    expect(membershipCoveredLabel({ settlementKind: "membership_covered" })).toBe("Membership-covered");
  });
  it("covered, not yet settled", () => {
    expect(membershipCoveredLabel({ membershipWashUsed: true, totalAmount: 0 })).toBe("Membership-covered, not yet settled");
  });
  it("ordinary jobs get no label", () => {
    expect(membershipCoveredLabel({ membershipWashUsed: false, totalAmount: 0 })).toBeNull();
    expect(membershipCoveredLabel({ membershipWashUsed: true, totalAmount: 100 })).toBeNull();
    expect(membershipCoveredLabel({})).toBeNull();
  });
});

/**
 * Unit tests for plan-snapshotted wash service binding (owner-approved
 * ladder 18 Nov 2026: all membership washes are Regular Wash).
 */
import { describe, it, expect } from "vitest";
import { freshGrant } from "../../lib/membership-grant.js";
import { membershipCoversWashService } from "../../lib/membership-eligibility.js";

const BASE_PLAN = {
  includedWashes: 4,
  freePickups: 1,
  prioritySlot: false,
  discountPercent: 0,
  includedInteriorRefreshes: 0,
};

describe("membershipCoversWashService", () => {
  it("bound membership: listed service is covered", () => {
    expect(
      membershipCoversWashService(
        { id: "svc-wash-regular", membershipWashEligible: true },
        { washServiceIds: ["svc-wash-regular"] },
      ),
    ).toBe(true);
  });

  it("bound membership: globally eligible but unlisted service is NOT covered", () => {
    expect(
      membershipCoversWashService(
        { id: "svc-wash-premium", membershipWashEligible: true },
        { washServiceIds: ["svc-wash-regular"] },
      ),
    ).toBe(false);
  });

  it("bound membership survives a later global flag change", () => {
    // Regular Wash flag flipped off after purchase: the snapshot still covers it.
    expect(
      membershipCoversWashService(
        { id: "svc-wash-regular", membershipWashEligible: false },
        { washServiceIds: ["svc-wash-regular"] },
      ),
    ).toBe(true);
  });

  it("legacy membership (no binding): global flag decides, eligible", () => {
    expect(
      membershipCoversWashService(
        { id: "svc-wash-premium", membershipWashEligible: true },
        {},
      ),
    ).toBe(true);
  });

  it("legacy membership (no binding): global flag decides, ineligible", () => {
    expect(
      membershipCoversWashService(
        { id: "svc-ppf", membershipWashEligible: false },
        {},
      ),
    ).toBe(false);
  });

  it("malformed binding (present but not an array) fails closed", () => {
    expect(
      membershipCoversWashService(
        { id: "svc-wash-regular", membershipWashEligible: true },
        { washServiceIds: "svc-wash-regular" as unknown as string[] },
      ),
    ).toBe(false);
  });
});

describe("freshGrant washServiceIds snapshot", () => {
  it("carries a copy of the plan binding when present", () => {
    const binding = ["svc-wash-regular"];
    const grant = freshGrant({ ...BASE_PLAN, washServiceIds: binding });
    expect(grant.washServiceIds).toEqual(["svc-wash-regular"]);
    // copy, not the plan's array reference
    expect(grant.washServiceIds).not.toBe(binding);
  });

  it("omits the field when the plan has no binding (legacy behavior)", () => {
    const grant = freshGrant(BASE_PLAN);
    expect("washServiceIds" in grant).toBe(false);
    expect(grant.washServiceIds).toBeUndefined();
  });
});

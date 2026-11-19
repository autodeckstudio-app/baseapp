import { describe, it, expect } from "vitest";
import { freshGrant } from "../../lib/membership-grant.js";
import {
  createMembershipPlanSchema,
  updateMembershipPlanSchema,
  recordMembershipRefreshSchema,
  restoreMembershipRefreshSchema,
} from "../../schemas/membership.js";

describe("freshGrant interior refresh snapshot", () => {
  it("snapshots the plan's refresh benefit with zero use", () => {
    const grant = freshGrant({
      includedWashes: 8,
      freePickups: 3,
      prioritySlot: true,
      discountPercent: 0,
      includedInteriorRefreshes: 1,
    });
    expect(grant.refreshesTotal).toBe(1);
    expect(grant.refreshesUsed).toBe(0);
    expect(grant.washesTotal).toBe(8);
    expect(grant.pickupsTotal).toBe(3);
  });

  it("a plan without the field grants no refresh", () => {
    const grant = freshGrant({
      includedWashes: 2,
      freePickups: 0,
      prioritySlot: false,
      discountPercent: 0,
    });
    expect(grant.refreshesTotal).toBe(0);
    expect(grant.refreshesUsed).toBe(0);
  });
});

describe("membership plan schemas: includedInteriorRefreshes", () => {
  const base = {
    tier: "platinum" as const,
    name: "Platinum",
    priceInPaise: 300000,
    includedWashes: 8,
    discountPercent: 0,
  };

  it("accepts a bounded integer and an omitted field", () => {
    expect(createMembershipPlanSchema.safeParse({ ...base, includedInteriorRefreshes: 1 }).success).toBe(true);
    expect(createMembershipPlanSchema.safeParse(base).success).toBe(true);
    expect(createMembershipPlanSchema.safeParse({ ...base, includedInteriorRefreshes: null }).success).toBe(true);
  });

  it("rejects negative, fractional and unbounded values", () => {
    expect(createMembershipPlanSchema.safeParse({ ...base, includedInteriorRefreshes: -1 }).success).toBe(false);
    expect(createMembershipPlanSchema.safeParse({ ...base, includedInteriorRefreshes: 0.5 }).success).toBe(false);
    expect(createMembershipPlanSchema.safeParse({ ...base, includedInteriorRefreshes: 32 }).success).toBe(false);
  });

  it("update schema accepts the field and treats null as leave-unchanged", () => {
    expect(updateMembershipPlanSchema.safeParse({ planId: "p1", includedInteriorRefreshes: 1 }).success).toBe(true);
    expect(updateMembershipPlanSchema.safeParse({ planId: "p1", includedInteriorRefreshes: null }).success).toBe(true);
    expect(updateMembershipPlanSchema.safeParse({ planId: "p1", includedInteriorRefreshes: 32 }).success).toBe(false);
  });
});

describe("refresh callable schemas", () => {
  it("record requires membershipId and jobId only", () => {
    expect(recordMembershipRefreshSchema.safeParse({ membershipId: "m", jobId: "j" }).success).toBe(true);
    expect(recordMembershipRefreshSchema.safeParse({ membershipId: "m" }).success).toBe(false);
    expect(recordMembershipRefreshSchema.safeParse({ membershipId: "m", jobId: "j", extra: 1 }).success).toBe(false);
  });

  it("restore requires a reason", () => {
    expect(restoreMembershipRefreshSchema.safeParse({ membershipId: "m", refreshUsageId: "r", reason: "visit cancelled" }).success).toBe(true);
    expect(restoreMembershipRefreshSchema.safeParse({ membershipId: "m", refreshUsageId: "r" }).success).toBe(false);
  });
});

import type { MembershipPlan } from "@autodeck/core";

/**
 * What a new membership starts with. Always the plan's own numbers, used count zero.
 * Owner rule (18 Oct): no washes carry forward. Unused washes end when the plan ends,
 * for a renewal and for an upgrade alike. Nothing here takes a previous plan as input on purpose.
 */
export function freshGrant(plan: Pick<MembershipPlan, "includedWashes" | "freePickups" | "prioritySlot" | "discountPercent" | "includedInteriorRefreshes">) {
  return {
    washesTotal: plan.includedWashes,
    washesUsed: 0,
    pickupsTotal: plan.freePickups ?? 0,
    pickupsUsed: 0,
    prioritySlot: plan.prioritySlot ?? false,
    refreshesTotal: plan.includedInteriorRefreshes ?? 0,
    refreshesUsed: 0,
    discountPercent: plan.discountPercent,
  };
}

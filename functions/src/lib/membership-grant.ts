import type { MembershipPlan } from "@autodeck/core";

/**
 * What a new membership starts with. Always the plan's own numbers, used count zero.
 * Owner rule (18 Oct): no washes carry forward. Unused washes end when the plan ends,
 * for a renewal and for an upgrade alike. Nothing here takes a previous plan as input on purpose.
 */
export function freshGrant(plan: Pick<MembershipPlan, "includedWashes" | "freePickups" | "prioritySlot" | "discountPercent">) {
  return {
    washesTotal: plan.includedWashes,
    washesUsed: 0,
    pickupsTotal: plan.freePickups ?? 0,
    pickupsUsed: 0,
    prioritySlot: plan.prioritySlot ?? false,
    discountPercent: plan.discountPercent,
  };
}

/**
 * ASSUMED, NOT CONFIRMED BY THE OWNER: an upgrade charges only the price difference.
 * Never negative; a same-price or cheaper plan is not an upgrade (returns null).
 */
export function upgradeDifferencePaise(current: Pick<MembershipPlan, "priceInPaise">, next: Pick<MembershipPlan, "priceInPaise">): number | null {
  const d = next.priceInPaise - current.priceInPaise;
  return d > 0 ? d : null;
}

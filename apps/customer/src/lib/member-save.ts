import type { MembershipPlan, Service } from "@autodeck/core";

/**
 * "Members save Rs X on this wash." X is exact and comes only from real data:
 * the price this customer would pay now (server total) minus the cheapest included-wash
 * rate among active plans (plan price / included washes). Returns null, so the line is
 * hidden, when the service is not wash-eligible, there is no plan data, or the saving is not above zero.
 * All values are paise.
 */
export function memberSaving(input: {
  service: Pick<Service, "membershipWashEligible" | "priceOnRequest"> | null | undefined;
  total: number | null | undefined;
  plans: Array<Pick<MembershipPlan, "priceInPaise" | "includedWashes" | "active">> | null | undefined;
}): number | null {
  const { service, total, plans } = input;
  if (!service || service.membershipWashEligible !== true || service.priceOnRequest === true) return null;
  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) return null;
  const rates = (plans ?? [])
    .filter((p) => p.active !== false && p.includedWashes > 0 && Number.isFinite(p.priceInPaise) && p.priceInPaise > 0)
    .map((p) => Math.round(p.priceInPaise / p.includedWashes));
  if (rates.length === 0) return null;
  const saving = total - Math.min(...rates);
  return saving > 0 ? saving : null;
}

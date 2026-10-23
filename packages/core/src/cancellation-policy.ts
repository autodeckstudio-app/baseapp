import { PAY_AT_STUDIO_GROUPS } from "./pay-online.js";
import { menuGroupOf } from "./menu.js";
import type { ServiceCategory } from "./types/service.js";

/** Customer cancellation rules. Two bands, both config. The "bigger" groups are the same list as pay-at-studio (pay-online.ts).
 *  Washes and short jobs: free until 4 hours before the start, then a flat fee.
 *  Bigger services: free until 24 hours before the start, then a share of the booking total.
 *  The fee is recorded on the booking and settled by the studio (taken from a prepaid refund, or collected at the studio). Nothing here moves money.
 *  Work already started: the customer cannot cancel online and the advance is not refunded. A cancel by the studio has no fee. */
export const CANCEL_SHORT = { freeUntilHours: 4, feePaise: 10_000 } as const;
export const CANCEL_BIGGER = { freeUntilHours: 24, feePercent: 20 } as const;

export type CancellationTerms = { bigger: boolean; freeUntilHours: number; free: boolean; feePaise: number };

/** Bigger if ANY service on the visit is bigger (primary or extras): the stricter rule wins. */
export function isBiggerVisit(categories: ReadonlyArray<ServiceCategory | string | null | undefined>): boolean {
  const known = categories.filter((c) => c !== null && c !== undefined && c !== "");
  return known.length ? known.some((c) => isBiggerService(c)) : isBiggerService(undefined);
}

export function isBiggerService(category: ServiceCategory | string | null | undefined): boolean {
  if (!category) return false;
  return (PAY_AT_STUDIO_GROUPS as readonly string[]).includes(menuGroupOf(category as ServiceCategory).key);
}

/** Terms for a customer cancelling now. totalPaise is the booking total. */
export function cancellationTerms(i: { category?: ServiceCategory | string | null | undefined; categories?: ReadonlyArray<ServiceCategory | string | null | undefined>; totalPaise: number; scheduledAtMs: number; nowMs: number }): CancellationTerms {
  const bigger = isBiggerVisit([i.category, ...(i.categories ?? [])]);
  const freeUntilHours = bigger ? CANCEL_BIGGER.freeUntilHours : CANCEL_SHORT.freeUntilHours;
  const hoursUntil = (i.scheduledAtMs - i.nowMs) / 3_600_000;
  const free = hoursUntil >= freeUntilHours;
  const raw = bigger ? Math.round((Math.max(0, i.totalPaise) * CANCEL_BIGGER.feePercent) / 100) : CANCEL_SHORT.feePaise;
  return { bigger, freeUntilHours, free, feePaise: free ? 0 : Math.min(raw, Math.max(0, i.totalPaise) || raw) };
}

/** One line for the customer, from the same numbers. */
export function cancellationLine(category: ServiceCategory | string | null | undefined): string {
  return isBiggerService(category)
    ? `Free to cancel until ${CANCEL_BIGGER.freeUntilHours} hours before the start. After that, ${CANCEL_BIGGER.feePercent}% of the booking total applies.`
    : `Free to cancel until ${CANCEL_SHORT.freeUntilHours} hours before the start. After that, Rs ${CANCEL_SHORT.feePaise / 100} applies.`;
}

/** Both bands in one sentence pair, for FAQs. Same numbers as cancellationLine and the Terms page. */
export function cancellationPolicySummary(): string {
  return `For washes and other short jobs, cancelling is free until ${CANCEL_SHORT.freeUntilHours} hours before the start; after that, Rs ${CANCEL_SHORT.feePaise / 100} applies. For bigger services (coatings, paint protection film, garage repairs and inspections, mods and wraps), cancelling is free until ${CANCEL_BIGGER.freeUntilHours} hours before the start; after that, ${CANCEL_BIGGER.feePercent}% of the booking total applies.`;
}

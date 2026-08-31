import { z } from 'zod';

export const ValidityDurationSchema = z.object({
  unit: z.enum(['day', 'month', 'year']),
  value: z.number().int().positive(),
});
export type ValidityDuration = z.infer<typeof ValidityDurationSchema>;

/**
 * Admin-defined package type (e.g. "10 Washes"). Paid 100% upfront — the
 * 40% advance rule in pricing.ts never applies to packages, by construction
 * (there is no shared code path between the two).
 */
export const PackageDefinitionSchema = z.object({
  packageDefinitionId: z.string().min(1),
  name: z.string().min(1),
  includedServiceId: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  validityDuration: ValidityDurationSchema,
});
export type PackageDefinition = z.infer<typeof PackageDefinitionSchema>;

/**
 * Adds `months` calendar months to `date` (UTC), clamping the day-of-month
 * to the last valid day of the resulting month when it would otherwise
 * overflow (e.g. Jan 31 + 1 month -> Feb 28, or Feb 29 in a leap year —
 * never rolling into the following month). All arithmetic is done in UTC
 * to avoid DST ambiguity. Not exported — an internal building block for
 * `calculatePackageExpiryDate`.
 */
function addCalendarMonthsUTC(date: Date, months: number): Date {
  const targetMonthIndex = date.getUTCMonth() + months;
  const daysInTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), targetMonthIndex + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), daysInTargetMonth);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      targetMonthIndex,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

/**
 * Calculates a package's expiry date from its purchase/activation date and
 * its admin-configured validity duration, using exactly these rules:
 *  - days:  add exactly N calendar days (N * 24h, computed in UTC)
 *  - months: calendar-month arithmetic (day-of-month clamped to the last
 *    valid day of the resulting month)
 *  - years:  calendar-year arithmetic (equivalent to N*12 calendar months —
 *    this also correctly clamps Feb 29 -> Feb 28 when the target year
 *    isn't a leap year)
 *
 * CONFIRMED: this is called exactly ONCE, at purchase/activation time. The
 * result must be persisted on the customer's package record. This function
 * must never be called again to "recheck" a package's expiry later —
 * `isPackageUsageEligible` only ever reads the already-persisted value.
 */
export function calculatePackageExpiryDate(purchaseDate: Date, duration: ValidityDuration): Date {
  switch (duration.unit) {
    case 'day':
      return new Date(purchaseDate.getTime() + duration.value * 24 * 60 * 60 * 1000);
    case 'month':
      return addCalendarMonthsUTC(purchaseDate, duration.value);
    case 'year':
      return addCalendarMonthsUTC(purchaseDate, duration.value * 12);
    default: {
      const exhaustiveCheck: never = duration.unit;
      throw new Error(`Unknown validity duration unit: ${String(exhaustiveCheck)}`);
    }
  }
}

export interface PackageUsageState {
  readonly remainingQty: number;
  readonly expiresAt: Date;
}

/**
 * Whether a package can be used right now.
 *
 * Takes `expiresAt` as an already-known value — the persisted result of a
 * single `calculatePackageExpiryDate` call made at purchase time. Never
 * recalculates expiry itself.
 */
export function isPackageUsageEligible(state: PackageUsageState, now: Date): boolean {
  return state.remainingQty > 0 && now.getTime() <= state.expiresAt.getTime();
}

export interface PackageConsumptionResult {
  readonly usedQty: number;
  readonly remainingQty: number;
}

/**
 * Computes the post-consumption counts for a single package usage.
 *
 * Pure — has no I/O and cannot itself prevent a concurrent double-spend.
 * The eventual caller (Phase 2's PackagesModule, not built yet) is
 * responsible for calling this inside a real Firestore `runTransaction`
 * against a freshly-read, consistent snapshot; this function only decides
 * what the correct resulting numbers are once given one.
 */
export function consumePackageUsage(
  current: { totalQty: number; usedQty: number; remainingQty: number },
  expiresAt: Date,
  now: Date
): Readonly<PackageConsumptionResult> {
  if (!isPackageUsageEligible({ remainingQty: current.remainingQty, expiresAt }, now)) {
    throw new Error('Package is not eligible for use (no remaining quantity, or expired)');
  }

  return Object.freeze({
    usedQty: current.usedQty + 1,
    remainingQty: current.remainingQty - 1,
  });
}

// Pay-at-studio 20% advance and no-show disclosure.
// Local release candidate only. Production activation remains separately gated.
import { NO_SHOW_ADVANCE_DISCLOSURE, NO_SHOW_FULL_ONLINE_DISCLOSURE, advanceSplit } from "@autodeck/core";
import type { PriceBreakdown } from "@autodeck/core";

export const ADVANCE_SPLIT_ENABLED = false;

/** Disclosure lines for the pay-at-studio choice once the advance flow is
 *  enabled. Percent (20%), basis and rounding are owner-adopted; the exact
 *  amount is computed from the booking price snapshot. The no-show line is the published no-show rule (
 *  docs/owner-decisions-2026-11-02.md section 4), disclosed BEFORE payment;
 *  it deliberately avoids cancellation wording - a no-show is not a late
 *  cancellation. */
export function advanceDisclosureLines(): { split: string; noShow: string; noShowFullOnline: string } {
  return {
    split: "You pay 20% online now to confirm; the rest at the studio when you collect your car.",
    noShow: NO_SHOW_ADVANCE_DISCLOSURE,
    // Full-online mode gets the same no-show rule with its own
    // wording: 20% of the service price kept, the remainder (incl unused
    // pickup/drop + GST) goes to owner refund approval, never auto-refunded.
    noShowFullOnline: NO_SHOW_FULL_ONLINE_DISCLOSURE,
  };
}

export type AdvancePreview = { advancePaise: number; dueAtStudioPaise: number; serviceTotalPaise: number };

const okMoney = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

/** Display-only preview of the pay-at-studio advance. Mirrors the server, which
 *  reads the ONE booking snapshot (functions/src/lib/booking-lines.ts
 *  addExtrasToBreakdown folds the visit's extra services INTO that snapshot's
 *  subtotal, so the advance covers the whole visit, one total per booking).
 *  Steps, in the server's order:
 *    1. visit subtotal = pb.subtotal + the extras' PRE-TAX prices (pass each
 *       extra's breakdown.subtotal, never its taxed total: the server taxes the
 *       combined amount once with Math.round, so adding separately taxed
 *       totals can differ by a paisa);
 *    2. tax = round((subtotal - membershipDiscount) * rate / 100), the
 *       membership discount staying on the main service only;
 *    3. advance = functions advance-payment derivation: 20% of
 *       (subtotal - pickup - drop - discount) + its tax, rounded up
 *       (core advanceSplit, "service_total_only" + "ceil");
 *    4. balance = grand total (incl pickup/drop and their GST) - advance.
 *  Returns null for any non-finite, negative or inconsistent input instead of
 *  a wrong amount. Uses the snapshot's own tax rate (0 with GST off). */
export function advancePreviewFromParts(
  pb: Pick<PriceBreakdown, "subtotal" | "pickupFee" | "dropFee" | "membershipDiscount" | "taxRatePercent">,
  extraSubtotalsPaise: readonly number[] = [],
): AdvancePreview | null {
  try {
    const discount = pb.membershipDiscount ?? 0;
    if (![pb.subtotal, pb.pickupFee, pb.dropFee, discount, ...extraSubtotalsPaise].every(okMoney)) return null;
    if (typeof pb.taxRatePercent !== "number" || !Number.isFinite(pb.taxRatePercent) || pb.taxRatePercent < 0) return null;
    const subtotal = pb.subtotal + extraSubtotalsPaise.reduce((a, b) => a + b, 0);
    const taxable = subtotal - discount;
    const service = subtotal - pb.pickupFee - pb.dropFee - discount;
    if (taxable < 0 || service < 0) return null;
    const grandTotal = taxable + Math.round((taxable * pb.taxRatePercent) / 100);
    const serviceTotal = service + Math.round((service * pb.taxRatePercent) / 100);
    const split = advanceSplit(serviceTotal, pb.pickupFee + pb.dropFee, "service_total_only", "ceil");
    const due = grandTotal - split.advancePaise;
    if (!okMoney(split.advancePaise) || due < 0) return null;
    // serviceTotalPaise: the discounted service price including GST, excluding
    // pickup/drop - the popup's "Service total" row and the basis of its
    // "Balance at studio (80%)" row (serviceTotalPaise - advancePaise).
    return { advancePaise: split.advancePaise, dueAtStudioPaise: due, serviceTotalPaise: serviceTotal };
  } catch {
    return null;
  }
}

/** One effective selection for display and execution. Covered and quote visits
 *  never request money even if a prior studio choice remains in component state. */
export function needsBookingAdvance(i: {
  enabled: boolean; studioSelected: boolean; onlineAvailable: boolean;
  giftCovered: boolean; membershipCovered: boolean; priceOnRequest: boolean;
  advancePaise: number | null;
}): boolean {
  return i.enabled && (i.studioSelected || !i.onlineAvailable) &&
    !i.giftCovered && !i.membershipCovered && !i.priceOnRequest &&
    i.advancePaise !== null && Number.isSafeInteger(i.advancePaise) && i.advancePaise > 0;
}

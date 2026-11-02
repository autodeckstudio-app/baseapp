// Pay-at-studio 20% advance (basket item 4) + no-show disclosure (item 5),
// PREVIEW. Item 5 policy is OWNER-APPROVED 2 Nov 21:32:50; the flow stays
// disabled until activation review.
// DISABLED by constant: the policy is OWNER-ADOPTED (2 Nov 2026, "All 3": 20% of
// the discounted service price incl GST excl pickup, advance rounded up to the
// next whole rupee, balance exact), but activation still requires (a) payment-
// flow wiring (Razorpay order for the advance) and (b) the final review gate.
// While disabled nothing computes an amount and nothing here is shown.
import { NO_SHOW_ADVANCE_DISCLOSURE, NO_SHOW_FULL_ONLINE_DISCLOSURE, advanceSplit } from "@autodeck/core";
import type { PriceBreakdown } from "@autodeck/core";

export const ADVANCE_SPLIT_ENABLED = false;

/** Disclosure lines for the pay-at-studio choice once the advance flow is
 *  enabled. Percent (20%), basis and rounding are owner-adopted; the exact
 *  amount is still not rendered while the flag is off (no payment mechanism
 *  yet). The no-show line is the OWNER-APPROVED rule (2 Nov 21:32:50,
 *  docs/owner-decisions-2026-11-02.md section 4), disclosed BEFORE payment;
 *  it deliberately avoids cancellation wording - a no-show is not a late
 *  cancellation. */
export function advanceDisclosureLines(): { split: string; noShow: string; noShowFullOnline: string } {
  return {
    split: "You pay 20% online now to confirm; the rest at the studio when you collect your car.",
    noShow: NO_SHOW_ADVANCE_DISCLOSURE,
    // Full-online mode gets the same owner-approved rule with its own
    // wording: 20% of the service price kept, the remainder (incl unused
    // pickup/drop + GST) goes to owner refund approval, never auto-refunded.
    noShowFullOnline: NO_SHOW_FULL_ONLINE_DISCLOSURE,
  };
}

export type AdvancePreview = { advancePaise: number; dueAtStudioPaise: number };

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
 *  a wrong amount. Uses the snapshot's own tax rate (0 with GST off). Not wired
 *  to any payment: ADVANCE_SPLIT_ENABLED stays false. */
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
    return { advancePaise: split.advancePaise, dueAtStudioPaise: due };
  } catch {
    return null;
  }
}

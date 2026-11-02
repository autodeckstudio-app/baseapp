// Pay-at-studio 20% advance (basket item 4) + no-show disclosure (item 5),
// PREVIEW. Item 5 policy is OWNER-APPROVED 2 Nov 21:32:50; the flow stays
// disabled until activation review.
// DISABLED by constant: the policy is OWNER-ADOPTED (2 Nov 2026, "All 3": 20% of
// the discounted service price incl GST excl pickup, advance rounded up to the
// next whole rupee, balance exact), but activation still requires (a) payment-
// flow wiring (Razorpay order for the advance) and (b) the final review gate.
// While disabled nothing computes an amount and nothing here is shown.
import { NO_SHOW_ADVANCE_DISCLOSURE } from "@autodeck/core";

export const ADVANCE_SPLIT_ENABLED = false;

/** Disclosure lines for the pay-at-studio choice once the advance flow is
 *  enabled. Percent (20%), basis and rounding are owner-adopted; the exact
 *  amount is still not rendered while the flag is off (no payment mechanism
 *  yet). The no-show line is the OWNER-APPROVED rule (2 Nov 21:32:50,
 *  docs/owner-decisions-2026-11-02.md section 4), disclosed BEFORE payment;
 *  it deliberately avoids cancellation wording - a no-show is not a late
 *  cancellation. */
export function advanceDisclosureLines(): { split: string; noShow: string } {
  return {
    split: "You pay 20% online now to confirm; the rest at the studio when you collect your car.",
    noShow: NO_SHOW_ADVANCE_DISCLOSURE,
  };
}

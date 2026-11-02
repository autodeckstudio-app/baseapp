// Pay-at-studio 20% advance (basket item 4), PREVIEW. Item 5 (no-show)
// deliberately has no copy here - it is NOT owner-confirmed.
// DISABLED by constant: the policy is OWNER-ADOPTED (2 Nov 2026, "All 3": 20% of
// the discounted service price incl GST excl pickup, advance rounded up to the
// next whole rupee, balance exact), but activation still requires (a) payment-
// flow wiring (Razorpay order for the advance) and (b) the final review gate.
// While disabled nothing computes an amount and nothing here is shown.
export const ADVANCE_SPLIT_ENABLED = false;

/** Disclosure lines for the pay-at-studio choice once the advance flow is
 *  enabled. Percent (20%), basis and rounding are owner-adopted; the exact
 *  amount is still not rendered while the flag is off (no payment mechanism
 *  yet). There is deliberately NO no-show line: no-show retention is NOT
 *  owner-confirmed (see docs/owner-decisions-2026-11-02.md section 4), so
 *  no retention or forfeiture wording may be shown to customers until the
 *  owner decides. Cancellation wording is avoided for the same reason. */
export function advanceDisclosureLines(): { split: string } {
  return {
    split: "You pay 20% online now to confirm; the rest at the studio when you collect your car.",
  };
}

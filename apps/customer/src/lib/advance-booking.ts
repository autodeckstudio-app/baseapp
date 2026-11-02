// Pay-at-studio 20% advance (basket item 4) + no-show disclosure (item 5), PREVIEW.
// DISABLED by constant: activation requires (a) the held owner decisions (advance
// basis incl. pickup fees; rounding), (b) payment-flow wiring (Razorpay order for
// the advance), and (c) the final review gate. While disabled nothing computes an
// amount and nothing here is shown - no held parameter is defaulted anywhere.
import { NO_SHOW_ADVANCE_DISCLOSURE } from "@autodeck/core";

export const ADVANCE_SPLIT_ENABLED = false;

/** Disclosure lines for the pay-at-studio choice once the advance flow is
 *  enabled. Percent is adopted (20%); the exact advance amount is NOT shown
 *  because its basis and rounding are held owner decisions. The no-show line
 *  discloses retention BEFORE payment (item 5) and deliberately avoids
 *  cancellation wording. The full-online x no-show retention interaction
 *  (refund of the remaining 80%) is a held refund-terms question, flagged. */
export function advanceDisclosureLines(): { split: string; noShow: string } {
  return {
    split: "You pay 20% online now to confirm; the rest at the studio when you collect your car.",
    noShow: NO_SHOW_ADVANCE_DISCLOSURE,
  };
}

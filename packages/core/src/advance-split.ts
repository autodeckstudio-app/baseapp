// Pay-at-studio advance split (basket item 4, PREVIEW - not activated).
// Adopted: the pay-at-studio choice takes a 20% advance online and 80% at the
// studio; the full-online path is untouched.
//
// Two policy inputs are OWNER-ADOPTED (2 Nov 2026, "All 3",
// phonemsg-01M6E9RW910BVRC0PJTQ3AG0M5):
//  - basis: "service_total_only" - the advance is 20% of the discounted
//    service price including GST, EXCLUDING pickup/drop.
//  - rounding: "ceil" - the advance rounds UP to the next whole rupee; the
//    balance is the exact remainder.
// Parameters stay REQUIRED with no defaults as defense-in-depth (no call site
// can silently assume a policy), but these are the adopted values.

export const ADVANCE_PERCENT = 20;

export type AdvanceBasis = "service_total_only" | "service_total_plus_pickup";
export type AdvanceRounding = "round" | "floor" | "ceil";

export type AdvanceSplit = {
  advancePaise: number;
  dueAtStudioPaise: number;
  basis: AdvanceBasis;
  rounding: AdvanceRounding;
};

export function advanceSplit(
  serviceTotalPaise: number,
  pickupTotalPaise: number,
  basis: AdvanceBasis,
  rounding: AdvanceRounding,
): AdvanceSplit {
  if (!Number.isInteger(serviceTotalPaise) || serviceTotalPaise < 0) throw new Error("serviceTotalPaise must be a non-negative integer (paise)");
  if (!Number.isInteger(pickupTotalPaise) || pickupTotalPaise < 0) throw new Error("pickupTotalPaise must be a non-negative integer (paise)");
  const basePaise = basis === "service_total_plus_pickup" ? serviceTotalPaise + pickupTotalPaise : serviceTotalPaise;
  const raw = (basePaise * ADVANCE_PERCENT) / 100;
  const advancePaise = rounding === "floor" ? Math.floor(raw) : rounding === "ceil" ? Math.ceil(raw) : Math.round(raw);
  // The studio balance is always the true remainder, never its own rounding of
  // 80% - so advance + balance always equals the full charge exactly.
  return { advancePaise, dueAtStudioPaise: basePaise - advancePaise, basis, rounding };
}

// Basket item 5 - OWNER-APPROVED 2 Nov 2026 21:32:50 IST ("Yes to the no
// show rule", phonemsg-01M6EFZJ3S6BG0DGV4VRH52WCE, after the 21:31:35
// clarification of the exact 21:24 proposal): on a no-show the studio
// keeps the 20% advance (discounted service incl GST, excl pickup/drop),
// nothing more is charged. Disclosure is shown BEFORE payment. A no-show
// is NOT a late cancellation - separate state, no cancellation wording.
export const NO_SHOW_ADVANCE_DISCLOSURE =
  "If you don't show up for your appointment, the studio keeps the 20% advance. Nothing more is charged.";

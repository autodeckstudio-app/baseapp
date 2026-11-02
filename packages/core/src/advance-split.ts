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

// Basket item 5 is NOT OWNER-CONFIRMED (re-checked 2 Nov 2026 21:04 on
// reviewer challenge): the retention rule was presented to the owner only
// via i2i and agent summaries, never on an owner channel. Three conflicting
// no-show candidates exist (20 Oct voice-note recital: retain FULL payment;
// a stale code comment: Rs 100 or 20%; Gauri basket: retain 20% of service
// cost). Until the owner decides, NO customer-facing retention or
// forfeiture copy may exist - not even behind the disabled flag - so this
// constant is intentionally REMOVED. When the owner decides, add decided
// wording here, shown BEFORE payment. A no-show is NOT automatically a late
// cancellation - it is a separate state and any future copy must not
// conflate them.

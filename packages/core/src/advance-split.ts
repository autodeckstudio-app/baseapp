// Pay-at-studio advance split (basket item 4, PREVIEW - not activated).
// Adopted: the pay-at-studio choice takes a 20% advance online and 80% at the
// studio; the full-online path is untouched.
//
// Two policy inputs are HELD owner decisions and are therefore REQUIRED
// parameters with no defaults, so no call site can silently assume them:
//  - basis: whether pickup/drop fees are part of the advance base
//    (held: "20% advance pickup-fee basis")
//  - rounding: how the 20% of paise is rounded (held under financial
//    consistency / rounding). Until these are decided, every caller must pass
//    an explicit value and label it provisional.

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

// Basket item 5 (PREVIEW copy - wording pending review): no-show keeps the
// advance. Disclosure must be shown BEFORE payment. A no-show is NOT
// automatically a late cancellation - it is a separate state and this copy
// must not conflate them.
export const NO_SHOW_ADVANCE_DISCLOSURE =
  "If you don't show up for your appointment, the 20% advance is kept by the studio.";

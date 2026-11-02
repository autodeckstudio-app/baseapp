// Pay-at-studio advance payment PREPARATION (basket item 4 - PREVIEW, not activated).
// This module only BUILDS the provider request for the 20% advance: it computes
// the amount via core advanceSplit and shapes a CreatePaymentLinkParams. It makes
// NO provider call and is never wired to a callable while
// ADVANCE_PAYMENT_ENABLED is false. Basis and rounding are owner-adopted
// (2 Nov 2026, "All 3": service price excl pickup, round up); core
// advance-split.ts keeps them as REQUIRED parameters (and so does this
// module) as defense-in-depth. Activation additionally requires the final
// review gate.
import { advanceSplit, type AdvanceBasis, type AdvanceRounding, type AdvanceSplit } from "@autodeck/core";
import { calculateTax } from "./pricing.js";

export const ADVANCE_PAYMENT_ENABLED = false;

/** Owner-adopted policy (2 Nov 2026, "All 3"): 20% of the discounted service
 *  price incl GST EXCL pickup, advance rounded UP, balance exact. Single
 *  source for every call site; the core helper still takes them as REQUIRED
 *  parameters so no site can silently assume a policy. */
export const ADVANCE_BASIS_POLICY = "service_total_only" as const;
export const ADVANCE_ROUNDING_POLICY = "ceil" as const;

export type AdvancePriceBreakdown = {
  /** Snapshotted subtotal = service + scope + addOns + pickupFee + dropFee
   *  (applyPickupFees folds pickup/drop INTO subtotal and taxes them). */
  subtotal: number;
  pickupFee: number;
  dropFee: number;
  membershipDiscount: number | null;
  taxRatePercent: number;
};

export type AdvanceBookingShape = {
  id: string;
  payMode: string;
  currency: string;
  priceBreakdown: AdvancePriceBreakdown;
  /** Set once an advance has been recorded for this booking. */
  advancePaymentId?: string | null;
};

/** PURE derivation of the advance base from a real snapshotted breakdown -
 *  testable while the flag stays off.
 *
 *  Proven against the pricing pipeline (functions/src/lib/pricing.ts,
 *  pickup-fee.ts, createBooking.ts composition):
 *   - calculatePrice: subtotal = base + scope; tax on subtotal.
 *   - applyMembershipBenefit: discount is taken on the SERVICE subtotal
 *     (before pickup); tax recomputed on (subtotal - discount).
 *   - applyPickupFees (later, pickupRequests/setBookingQuote): pickup and
 *     drop fees are folded INTO subtotal and the SAME discount is kept, so
 *     tax = round((service + pickup + drop - discount) * rate) - pickup
 *     fees carry GST inside the snapshot's tax and total.
 *  The adopted base (discounted service incl GST, EXCL pickup) is therefore
 *  NOT total - pickupFee - dropFee (that keeps the pickup GST). It is the
 *  service portion re-taxed at the snapshot's own rate:
 *    (subtotal - pickupFee - dropFee - membershipDiscount)
 *      + round(same * taxRatePercent / 100)
 *  matching the pipeline's integer rounding for the service portion exactly.
 *  A fully covered wash (discount absorbs the service subtotal) yields a
 *  zero base and a zero advance - correct: nothing remains to advance. */
export function computeAdvanceSplitFromBreakdown(
  pb: AdvancePriceBreakdown,
  basis: AdvanceBasis,
  rounding: AdvanceRounding,
): AdvanceSplit {
  const serviceSubtotal = pb.subtotal - pb.pickupFee - pb.dropFee;
  const discountedService = serviceSubtotal - (pb.membershipDiscount ?? 0);
  const serviceTax = calculateTax(discountedService, pb.taxRatePercent);
  const serviceTotal = discountedService + serviceTax;
  return advanceSplit(serviceTotal, pb.pickupFee + pb.dropFee, basis, rounding);
}

export type AdvancePaymentRequest = {
  amountPaise: number;
  currency: string;
  bookingId: string;
  description: string;
  /** Deterministic per booking: a provider retry reuses the same reference,
   *  matching the stored-order-id idempotency pattern in checkout-order.ts. */
  referenceId: string;
  advancePaise: number;
  dueAtStudioPaise: number;
};

export function buildAdvancePaymentRequest(
  booking: AdvanceBookingShape,
  basis: AdvanceBasis,
  rounding: AdvanceRounding,
): AdvancePaymentRequest {
  if (!ADVANCE_PAYMENT_ENABLED) {
    throw new Error("Advance split payments are disabled (ADVANCE_PAYMENT_ENABLED=false): policy is owner-adopted; the activation gate (final review) is outstanding.");
  }
  if (booking.payMode !== "studio") {
    throw new Error(`Advance applies to pay-at-studio bookings only (payMode=${booking.payMode}).`);
  }
  if (booking.advancePaymentId) {
    throw new Error("An advance payment is already recorded for this booking.");
  }
  const split = computeAdvanceSplitFromBreakdown(booking.priceBreakdown, basis, rounding);
  return {
    amountPaise: split.advancePaise,
    currency: booking.currency,
    bookingId: booking.id,
    description: "Advance for your AutoDeck booking (balance payable at the studio)",
    referenceId: `advance-${booking.id}`,
    advancePaise: split.advancePaise,
    dueAtStudioPaise: split.dueAtStudioPaise,
  };
}

// Pay-at-studio advance payment PREPARATION (basket item 4 - PREVIEW, not activated).
// This module only BUILDS the provider request for the 20% advance: it computes
// the amount via core advanceSplit and shapes a CreatePaymentLinkParams. It makes
// NO provider call and is never wired to a callable while
// ADVANCE_PAYMENT_ENABLED is false. Basis and rounding are owner-adopted
// (2 Nov 2026, "All 3": service price excl pickup, round up); core
// advance-split.ts keeps them as REQUIRED parameters (and so does this
// module) as defense-in-depth. Activation additionally requires the final
// review gate.
import { advanceSplit, type AdvanceBasis, type AdvanceRounding } from "@autodeck/core";

export const ADVANCE_PAYMENT_ENABLED = false;

export type AdvanceBookingShape = {
  id: string;
  payMode: string;
  currency: string;
  priceBreakdown: { total: number };
  /** Pickup/drop fees in paise when present on the booking (0 when none). */
  pickupTotalPaise?: number | null;
  /** Set once an advance has been recorded for this booking. */
  advancePaymentId?: string | null;
};

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
    throw new Error("Advance split payments are disabled (ADVANCE_PAYMENT_ENABLED=false): held owner decisions (basis, rounding) and activation gate are outstanding.");
  }
  if (booking.payMode !== "studio") {
    throw new Error(`Advance applies to pay-at-studio bookings only (payMode=${booking.payMode}).`);
  }
  if (booking.advancePaymentId) {
    throw new Error("An advance payment is already recorded for this booking.");
  }
  const split = advanceSplit(booking.priceBreakdown.total, booking.pickupTotalPaise ?? 0, basis, rounding);
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

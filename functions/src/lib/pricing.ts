// Pure pricing calculation. No Firebase imports — fully unit-testable.
// All monetary values are in paise (INR * 100). No floating-point arithmetic for money.
import type { VehicleCategoryPricing, VehicleCategory, PriceBreakdown } from "@autodeck/core";
import {
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE_PERCENT,
  DEFAULT_TAX_DESCRIPTION,
} from "@autodeck/core";

export interface CalculatePriceInput {
  basePrice: number; // paise
  vehicleCategory: VehicleCategory;
  vehicleCategoryPricing: VehicleCategoryPricing[];
  taxRatePercent?: number; // defaults to DEFAULT_TAX_RATE_PERCENT (18)
  taxDescription?: string; // defaults to DEFAULT_TAX_DESCRIPTION ("GST 18%")
  currency?: string; // defaults to DEFAULT_CURRENCY ("INR")
}

export function calculatePrice(input: CalculatePriceInput): PriceBreakdown {
  assertValidMinorUnits(input.basePrice, "basePrice");

  const taxRatePercent = input.taxRatePercent ?? DEFAULT_TAX_RATE_PERCENT;
  const taxDescription = input.taxDescription ?? DEFAULT_TAX_DESCRIPTION;
  const currency = input.currency ?? DEFAULT_CURRENCY;

  const categoryRule = input.vehicleCategoryPricing.find(
    (r) => r.vehicleCategory === input.vehicleCategory,
  );
  const scopeAdjustment = categoryRule?.additionalPricePaise ?? 0;

  assertValidMinorUnits(scopeAdjustment, "vehicleCategoryPricing.additionalPricePaise");

  const subtotal = input.basePrice + scopeAdjustment;
  const tax = calculateTax(subtotal, taxRatePercent);
  const total = subtotal + tax;

  return {
    vehicleCategory: input.vehicleCategory,
    basePrice: input.basePrice,
    scopeAdjustment,
    addOns: [], // V1: no add-ons
    subtotal,
    membershipDiscount: null, // V1: no membership
    membershipDiscountPercent: null,
    pickupFee: 0, // V1: no pickup/drop
    dropFee: 0,
    taxRatePercent,
    taxDescription,
    tax,
    total,
    currency,
  };
}

export interface MembershipBenefitInput {
  discountPercent: number; // membership.discountPercent
  consumeWash: boolean; // true when an included wash credit is being redeemed
}

// Applies a membership benefit to an already-computed base breakdown.
// Mutually exclusive per booking (D-10 / doc03 §Membership):
//   - consumeWash: the service is fully covered by an included wash credit —
//     membershipDiscount absorbs the entire subtotal, tax is recomputed on the
//     remaining (zero) subtotal, total becomes 0.
//   - !consumeWash: a percentage discount (discountPercent) is applied to the
//     subtotal before tax — "N% off other services".
// Never mutates the input; returns a new PriceBreakdown.
export function applyMembershipBenefit(
  base: PriceBreakdown,
  benefit: MembershipBenefitInput,
): PriceBreakdown {
  const membershipDiscount = benefit.consumeWash
    ? base.subtotal
    : Math.round((base.subtotal * benefit.discountPercent) / 100);

  assertValidMinorUnits(membershipDiscount, "membershipDiscount");

  const taxableSubtotal = base.subtotal - membershipDiscount;
  const tax = calculateTax(taxableSubtotal, base.taxRatePercent);
  const total = taxableSubtotal + tax;

  return {
    ...base,
    membershipDiscount,
    membershipDiscountPercent: benefit.consumeWash ? null : benefit.discountPercent,
    tax,
    total,
  };
}

// Integer-safe GST calculation.
// Rounds to the nearest paise: Math.round avoids systematic bias (banker's rounding is V2+).
export function calculateTax(subtotalPaise: number, taxRatePercent: number): number {
  return Math.round((subtotalPaise * taxRatePercent) / 100);
}

// Guards against floating-point prices or negative values.
// Must be called on every input from the client or Firestore before arithmetic.
export function assertValidMinorUnits(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer (paise). Got: ${value}`);
  }
  if (value < 0) {
    throw new Error(`${field} must be non-negative (paise). Got: ${value}`);
  }
}

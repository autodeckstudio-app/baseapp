import { describe, it, expect } from "vitest";
import { calculatePrice, calculateTax, assertValidMinorUnits, applyMembershipBenefit } from "../../lib/pricing.js";
import type { VehicleCategoryPricing } from "@autodeck/core";
import { DEFAULT_CURRENCY, DEFAULT_TAX_RATE_PERCENT, DEFAULT_TAX_DESCRIPTION } from "@autodeck/core";

const NO_CATEGORY_PRICING: VehicleCategoryPricing[] = [];

const CATEGORY_PRICING: VehicleCategoryPricing[] = [
  { vehicleCategory: "hatchback", additionalPricePaise: 0, additionalMinutes: 0 },
  { vehicleCategory: "sedan", additionalPricePaise: 50000, additionalMinutes: 30 },
  { vehicleCategory: "suv", additionalPricePaise: 100000, additionalMinutes: 60 },
  { vehicleCategory: "luxury", additionalPricePaise: 200000, additionalMinutes: 90 },
  { vehicleCategory: "commercial", additionalPricePaise: 150000, additionalMinutes: 60 },
  { vehicleCategory: "van", additionalPricePaise: 120000, additionalMinutes: 45 },
];

describe("calculateTax", () => {
  it("applies 18% GST correctly", () => {
    // 100000 paise * 18% = 18000 paise
    expect(calculateTax(100000, 18)).toBe(18000);
  });

  it("rounds half-up to nearest paise", () => {
    // 100001 * 18 / 100 = 18000.18 → rounds to 18000
    expect(calculateTax(100001, 18)).toBe(18000);
    // 100005 * 18 / 100 = 18000.9 → rounds to 18001
    expect(calculateTax(100005, 18)).toBe(18001);
  });

  it("returns 0 for zero subtotal", () => {
    expect(calculateTax(0, 18)).toBe(0);
  });

  it("works for 5% tax rate", () => {
    expect(calculateTax(10000, 5)).toBe(500);
  });

  it("works for 0% tax rate", () => {
    expect(calculateTax(50000, 0)).toBe(0);
  });

  it("produces integer result", () => {
    const result = calculateTax(33333, 18);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("assertValidMinorUnits", () => {
  it("accepts zero", () => {
    expect(() => assertValidMinorUnits(0, "price")).not.toThrow();
  });

  it("accepts a valid positive integer", () => {
    expect(() => assertValidMinorUnits(100000, "price")).not.toThrow();
  });

  it("rejects negative values", () => {
    expect(() => assertValidMinorUnits(-1, "price")).toThrow(/non-negative/);
  });

  it("rejects floating-point values", () => {
    expect(() => assertValidMinorUnits(100.5, "price")).toThrow(/integer/);
  });

  it("rejects NaN", () => {
    expect(() => assertValidMinorUnits(NaN, "price")).toThrow(/integer/);
  });
});

describe("calculatePrice", () => {
  it("returns correct total for hatchback at base price", () => {
    const result = calculatePrice({
      basePrice: 500000, // ₹5000.00
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    expect(result.basePrice).toBe(500000);
    expect(result.scopeAdjustment).toBe(0);
    expect(result.subtotal).toBe(500000);
    expect(result.tax).toBe(90000); // 18% of 500000
    expect(result.total).toBe(590000);
    expect(result.currency).toBe(DEFAULT_CURRENCY);
    expect(result.taxRatePercent).toBe(DEFAULT_TAX_RATE_PERCENT);
    expect(result.taxDescription).toBe(DEFAULT_TAX_DESCRIPTION);
  });

  it("applies SUV category adjustment to price", () => {
    const result = calculatePrice({
      basePrice: 500000,
      vehicleCategory: "suv",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    expect(result.scopeAdjustment).toBe(100000);
    expect(result.subtotal).toBe(600000);
    expect(result.tax).toBe(108000); // 18% of 600000
    expect(result.total).toBe(708000);
  });

  it("applies luxury category adjustment", () => {
    const result = calculatePrice({
      basePrice: 500000,
      vehicleCategory: "luxury",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    expect(result.scopeAdjustment).toBe(200000);
    expect(result.subtotal).toBe(700000);
    expect(result.total).toBe(826000); // 700000 + 126000 (18%)
  });

  it("uses zero adjustment for categories not in pricing list", () => {
    const result = calculatePrice({
      basePrice: 300000,
      vehicleCategory: "sedan",
      vehicleCategoryPricing: NO_CATEGORY_PRICING, // empty — no overrides
    });
    expect(result.scopeAdjustment).toBe(0);
    expect(result.subtotal).toBe(300000);
  });

  it("returns zero total for free service", () => {
    const result = calculatePrice({
      basePrice: 0,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });
    expect(result.basePrice).toBe(0);
    expect(result.subtotal).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(0);
  });

  it("handles van category", () => {
    const result = calculatePrice({
      basePrice: 200000,
      vehicleCategory: "van",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    expect(result.scopeAdjustment).toBe(120000);
    expect(result.vehicleCategory).toBe("van");
  });

  it("returns empty add-ons array in V1", () => {
    const result = calculatePrice({
      basePrice: 100000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });
    expect(result.addOns).toEqual([]);
  });

  it("returns null membership discount in V1", () => {
    const result = calculatePrice({
      basePrice: 100000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });
    expect(result.membershipDiscount).toBeNull();
    expect(result.membershipDiscountPercent).toBeNull();
  });

  it("returns zero pickup/drop fees in V1", () => {
    const result = calculatePrice({
      basePrice: 100000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });
    expect(result.pickupFee).toBe(0);
    expect(result.dropFee).toBe(0);
  });

  it("uses custom tax rate when provided", () => {
    const result = calculatePrice({
      basePrice: 100000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
      taxRatePercent: 5,
      taxDescription: "GST 5%",
    });
    expect(result.taxRatePercent).toBe(5);
    expect(result.taxDescription).toBe("GST 5%");
    expect(result.tax).toBe(5000);
    expect(result.total).toBe(105000);
  });

  it("rejects negative base price", () => {
    expect(() =>
      calculatePrice({
        basePrice: -1,
        vehicleCategory: "hatchback",
        vehicleCategoryPricing: NO_CATEGORY_PRICING,
      }),
    ).toThrow(/non-negative/);
  });

  it("rejects floating-point base price", () => {
    expect(() =>
      calculatePrice({
        basePrice: 100.5,
        vehicleCategory: "hatchback",
        vehicleCategoryPricing: NO_CATEGORY_PRICING,
      }),
    ).toThrow(/integer/);
  });

  it("produces only integers in the result", () => {
    const result = calculatePrice({
      basePrice: 333333,
      vehicleCategory: "sedan",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    expect(Number.isInteger(result.basePrice)).toBe(true);
    expect(Number.isInteger(result.scopeAdjustment)).toBe(true);
    expect(Number.isInteger(result.subtotal)).toBe(true);
    expect(Number.isInteger(result.tax)).toBe(true);
    expect(Number.isInteger(result.total)).toBe(true);
  });

  it("price snapshot is deterministic: same inputs produce same result", () => {
    const input = {
      basePrice: 750000,
      vehicleCategory: "suv" as const,
      vehicleCategoryPricing: CATEGORY_PRICING,
    };
    const r1 = calculatePrice(input);
    const r2 = calculatePrice(input);
    expect(r1).toEqual(r2);
  });

  it("sedan pricing is independent of suv pricing (no cross-category contamination)", () => {
    const sedan = calculatePrice({
      basePrice: 500000,
      vehicleCategory: "sedan",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    const suv = calculatePrice({
      basePrice: 500000,
      vehicleCategory: "suv",
      vehicleCategoryPricing: CATEGORY_PRICING,
    });
    expect(sedan.scopeAdjustment).toBe(50000);
    expect(suv.scopeAdjustment).toBe(100000);
    expect(sedan.total).toBeLessThan(suv.total);
  });
});

describe("historical price snapshot immutability", () => {
  it("a price snapshot reflects pricing at calculation time, not current service state", () => {
    // Simulates: customer requests price quote → system captures snapshot →
    // admin later changes basePrice → existing snapshot is unaffected
    const originalInput = {
      basePrice: 500000,
      vehicleCategory: "hatchback" as const,
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    };
    const snapshot = calculatePrice(originalInput);

    // Admin changes basePrice to 600000 — existing snapshot must not change
    const newInput = { ...originalInput, basePrice: 600000 };
    const newQuote = calculatePrice(newInput);

    // Snapshot values are frozen at point of calculation
    expect(snapshot.total).toBe(590000); // original price
    expect(newQuote.total).toBe(708000); // new price
    expect(snapshot.total).not.toBe(newQuote.total);
  });
});

describe("applyMembershipBenefit", () => {
  const base = calculatePrice({
    basePrice: 500000,
    vehicleCategory: "hatchback",
    vehicleCategoryPricing: NO_CATEGORY_PRICING,
  });

  it("consumeWash zeroes the total (fully covered by an included wash credit)", () => {
    const result = applyMembershipBenefit(base, { discountPercent: 10, consumeWash: true });
    expect(result.membershipDiscount).toBe(base.subtotal);
    expect(result.membershipDiscountPercent).toBeNull();
    expect(result.tax).toBe(0);
    expect(result.total).toBe(0);
  });

  it("percent discount reduces subtotal before tax, does not zero the total", () => {
    const result = applyMembershipBenefit(base, { discountPercent: 10, consumeWash: false });
    const expectedDiscount = Math.round(base.subtotal * 0.1);
    expect(result.membershipDiscount).toBe(expectedDiscount);
    expect(result.membershipDiscountPercent).toBe(10);
    expect(result.tax).toBe(calculateTax(base.subtotal - expectedDiscount, base.taxRatePercent));
    expect(result.total).toBe(base.subtotal - expectedDiscount + result.tax);
  });

  it("0% discount with no wash consumption leaves the price unchanged", () => {
    const result = applyMembershipBenefit(base, { discountPercent: 0, consumeWash: false });
    expect(result.membershipDiscount).toBe(0);
    expect(result.total).toBe(base.total);
  });

  it("does not mutate the input breakdown", () => {
    const before = { ...base };
    applyMembershipBenefit(base, { discountPercent: 20, consumeWash: false });
    expect(base).toEqual(before);
  });
});

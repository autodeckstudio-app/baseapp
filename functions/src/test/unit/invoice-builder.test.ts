// Regression coverage for Phase 5B P1-9: Invoice.discount must explicitly
// represent any membership benefit applied, so subtotal - discount + tax =
// total always holds and the discount is never silently folded into total
// with nothing on the document explaining the gap.
import { describe, it, expect } from "vitest";
import type { VehicleCategoryPricing, PriceBreakdown } from "@autodeck/core";
import { calculatePrice, applyMembershipBenefit, calculateTax } from "../../lib/pricing.js";
import { buildInvoice, type BuildInvoiceParams } from "../../lib/invoice-builder.js";

const NO_CATEGORY_PRICING: VehicleCategoryPricing[] = [];

function baseParams(priceBreakdown: PriceBreakdown): BuildInvoiceParams {
  return {
    invoiceId: "inv-1",
    invoiceNumber: "INV-TEST-0001",
    tenantId: "tenant-1",
    studioId: "studio-1",
    jobId: "job-1",
    bookingId: "booking-1",
    customerId: "cust-1",
    vehicleId: "veh-1",
    paymentId: "pay-1",
    serviceName: "Premium Wash",
    priceBreakdown,
  };
}

describe("buildInvoice — reconciliation (Phase 5B P1-9)", () => {
  it("normal paid job (no membership benefit): discount is 0, subtotal - discount + tax = total", () => {
    const pb = calculatePrice({
      basePrice: 500000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });

    const invoice = buildInvoice(baseParams(pb));

    expect(invoice.discount).toBe(0);
    expect(invoice.discountDescription).toBeNull();
    expect(invoice.subtotal).toBe(pb.subtotal);
    expect(invoice.subtotal - invoice.discount + invoice.tax).toBe(invoice.total);
    expect(invoice.total).toBe(pb.total);
  });

  it("partially discounted membership job: gross subtotal preserved, discount explicit, tax computed on the post-discount amount, reconciles", () => {
    const base = calculatePrice({
      basePrice: 500000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });
    const pb = applyMembershipBenefit(base, { discountPercent: 20, consumeWash: false });

    const invoice = buildInvoice(baseParams(pb));

    // Gross subtotal is NOT reduced by the discount — it stays the
    // pre-benefit amount, matching the "preserve gross subtotal" and "do
    // not hide the discount inside total" requirements.
    expect(invoice.subtotal).toBe(base.subtotal);
    expect(invoice.discount).toBe(Math.round(base.subtotal * 0.2));
    expect(invoice.discount).toBeGreaterThan(0);
    expect(invoice.discountDescription).toBe("Membership discount (20%)");

    const expectedTaxableSubtotal = base.subtotal - invoice.discount;
    expect(invoice.tax).toBe(calculateTax(expectedTaxableSubtotal, base.taxRatePercent));
    expect(invoice.total).toBe(expectedTaxableSubtotal + invoice.tax);

    // The core invariant this fix exists for.
    expect(invoice.subtotal - invoice.discount + invoice.tax).toBe(invoice.total);
  });

  it("fully covered membership job (wash credit): discount equals the full gross subtotal, tax and total are 0, but subtotal is still preserved and reconciles", () => {
    const base = calculatePrice({
      basePrice: 400000,
      vehicleCategory: "hatchback",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
    });
    const pb = applyMembershipBenefit(base, { discountPercent: 20, consumeWash: true });

    const invoice = buildInvoice(baseParams(pb));

    expect(invoice.subtotal).toBe(base.subtotal); // NOT zero — the gross price is still on record
    expect(invoice.discount).toBe(base.subtotal); // fully absorbed
    expect(invoice.discountDescription).toBe("Membership wash credit");
    expect(invoice.tax).toBe(0);
    expect(invoice.total).toBe(0);

    // Reconciles even in the fully-covered case: subtotal - discount + tax = total = 0.
    expect(invoice.subtotal - invoice.discount + invoice.tax).toBe(invoice.total);
  });

  it("tax reconciliation: tax is always computed on the post-discount taxable amount, never on the gross subtotal", () => {
    const base = calculatePrice({
      basePrice: 1000000,
      vehicleCategory: "sedan",
      vehicleCategoryPricing: NO_CATEGORY_PRICING,
      taxRatePercent: 18,
    });
    const pb = applyMembershipBenefit(base, { discountPercent: 50, consumeWash: false });
    const invoice = buildInvoice(baseParams(pb));

    const taxOnGross = calculateTax(base.subtotal, 18);
    const taxOnTaxable = calculateTax(base.subtotal - invoice.discount, 18);

    expect(invoice.tax).toBe(taxOnTaxable);
    expect(invoice.tax).not.toBe(taxOnGross); // would be wrong — taxing pre-discount amount
    expect(invoice.subtotal - invoice.discount + invoice.tax).toBe(invoice.total);
  });
});

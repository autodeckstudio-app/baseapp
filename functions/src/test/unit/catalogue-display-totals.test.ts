import { describe, it, expect } from "vitest";
import { GST_ENABLED, DEFAULT_TAX_RATE_PERCENT, isSizePriced, type Service, type ServiceCategory, type VehicleCategory } from "@autodeck/core";
import { calculatePrice, taxFor } from "../../lib/pricing.js";

// Parity fixtures for getServiceCatalogue's optional displayTotals: the map the catalogue
// endpoint returns for list tiles must equal what calculateServicePrice returns per service,
// across every category, the GST gate both ways, and paise rounding. Booking confirm still
// re-prices server-side; these totals are display-only.
const VEHICLES: VehicleCategory[] = ["hatchback", "sedan", "suv", "luxury", "commercial", "van"];
const CATEGORIES: ServiceCategory[] = ["washing", "ceramic", "coating", "garage", "modifications", "pickup", "ppf"];

// Mirrors the displayTotals loop in functions/service/getServiceCatalogue.ts.
function displayTotalsFor(services: Array<Pick<Service, "id" | "category" | "basePrice" | "currency" | "vehicleCategoryPricing" | "priceOnRequest">>, vehicleCategory: VehicleCategory): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const svc of services) {
    if (svc.priceOnRequest === true) continue;
    if (isSizePriced(svc.category) && !(svc.vehicleCategoryPricing ?? []).some((r) => r.vehicleCategory === vehicleCategory)) continue;
    const breakdown = calculatePrice({
      basePrice: svc.basePrice,
      serviceCategory: svc.category,
      vehicleCategory,
      vehicleCategoryPricing: svc.vehicleCategoryPricing ?? [],
      currency: svc.currency,
      ...taxFor(null),
    });
    totals[svc.id] = breakdown.total;
  }
  return totals;
}

const fixture = (id: string, category: ServiceCategory, basePrice: number, extraPaise: number, priceOnRequest = false) => ({
  id,
  category,
  basePrice,
  currency: "INR",
  // Deliberately NOT sizePricingForCategory output: live documents carry their own rows
  // (e.g. a 60,000 uplift on a 1,00,000 base for luxury), and the server must price from
  // the document, never from a recomputed formula.
  vehicleCategoryPricing: VEHICLES.map((v) => ({ vehicleCategory: v, additionalPricePaise: v === "hatchback" ? 0 : extraPaise, additionalMinutes: 0 })),
  priceOnRequest,
});

describe("catalogue display totals parity", () => {
  it("every category totals base + document size row (PPF) or flat base, tax gated", () => {
    const services = CATEGORIES.map((c) => fixture(`svc-${c}`, c, 123450, 30000));
    for (const vehicleCategory of VEHICLES) {
      const totals = displayTotalsFor(services, vehicleCategory);
      for (const c of CATEGORIES) {
        const extra = isSizePriced(c) && vehicleCategory !== "hatchback" ? 30000 : 0;
        const subtotal = 123450 + extra;
        const tax = GST_ENABLED ? Math.round((subtotal * DEFAULT_TAX_RATE_PERCENT) / 100) : 0;
        expect(totals[`svc-${c}`], `${c}/${vehicleCategory}`).toBe(subtotal + tax);
      }
    }
  });
  it("matches calculateServicePrice's engine field-for-field on the same input", () => {
    // 1,00,000 base, 60,000 luxury row: the live menu-ppf-3m-full-body shape.
    const ppf = fixture("menu-ppf", "ppf", 10000000, 6000000);
    const totals = displayTotalsFor([ppf], "luxury");
    const direct = calculatePrice({ basePrice: 10000000, serviceCategory: "ppf", vehicleCategory: "luxury", vehicleCategoryPricing: ppf.vehicleCategoryPricing, currency: "INR", ...taxFor(null) });
    expect(totals["menu-ppf"]).toBe(direct.total);
    expect(totals["menu-ppf"]).toBe(16000000); // GST off: base + row, no tax
  });
  it("rounds tax to the paise with Math.round when GST is on", () => {
    const taxable = { taxRatePercent: DEFAULT_TAX_RATE_PERCENT, taxDescription: "GST 18%" };
    // 101 paise base: 18.18 paise tax rounds to 18; verifies integer rounding path.
    const b = calculatePrice({ basePrice: 101, serviceCategory: "washing", vehicleCategory: "hatchback", vehicleCategoryPricing: [], ...taxable });
    expect(b.tax).toBe(Math.round((101 * DEFAULT_TAX_RATE_PERCENT) / 100));
    expect(b.total).toBe(b.subtotal + b.tax);
    expect(Number.isInteger(b.total)).toBe(true);
  });
  it("quote-on-request services get no display total", () => {
    const totals = displayTotalsFor([fixture("svc-quote", "ppf", 0, 0, true)], "sedan");
    expect(totals).toEqual({});
  });
  it("size-priced services missing the requested size row are OMITTED, never shown as flat base", () => {
    const noRows = { ...fixture("svc-norows", "ppf", 50000, 0), vehicleCategoryPricing: undefined as unknown as [] };
    expect(displayTotalsFor([noRows], "suv")).toEqual({});
    const wrongRow = fixture("svc-wrongrow", "ppf", 50000, 0).vehicleCategoryPricing.filter((r) => r.vehicleCategory === "hatchback");
    expect(displayTotalsFor([{ ...fixture("svc-wrongrow", "ppf", 50000, 0), vehicleCategoryPricing: wrongRow }], "suv")).toEqual({});
    // Non-size-priced categories are flat by design and still get totals without rows.
    const flat = { ...fixture("svc-flat", "washing", 50000, 0), vehicleCategoryPricing: undefined as unknown as [] };
    expect(displayTotalsFor([flat], "suv")["svc-flat"]).toBe(50000);
  });
});

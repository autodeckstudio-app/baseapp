import { describe, it, expect } from "vitest";
import { SIZE_PRICED_CATEGORIES, isSizePriced, sizePricingForCategory, menuPriceText, MENU_SEED, type ServiceCategory } from "@autodeck/core";
import { calculatePrice } from "../../lib/pricing.js";

const sizeRows = [
  { vehicleCategory: "sedan" as const, additionalPricePaise: 22500, additionalMinutes: 0 },
  { vehicleCategory: "suv" as const, additionalPricePaise: 22500, additionalMinutes: 0 },
  { vehicleCategory: "luxury" as const, additionalPricePaise: 54000, additionalMinutes: 0 },
  { vehicleCategory: "commercial" as const, additionalPricePaise: 22500, additionalMinutes: 0 },
];
const tax = { taxRatePercent: 0, taxDescription: "none" };

describe("only PPF is priced by car size", () => {
  it("PPF is the only size-priced category", () => {
    expect(SIZE_PRICED_CATEGORIES).toEqual(["ppf"]);
  });
  it("every non-PPF category charges the same price for every car, even if old data carries surcharge rows", () => {
    const cats: ServiceCategory[] = ["washing", "ceramic", "coating", "garage", "modifications", "pickup", "tinting", "inspection", "other"];
    for (const serviceCategory of cats) {
      for (const vehicleCategory of ["hatchback", "sedan", "suv", "luxury", "commercial", "van"] as const) {
        const b = calculatePrice({ basePrice: 90000, serviceCategory, vehicleCategory, vehicleCategoryPricing: sizeRows, ...tax });
        expect(b.subtotal, `${serviceCategory}/${vehicleCategory}`).toBe(90000);
        expect(b.scopeAdjustment).toBe(0);
      }
    }
  });
  it("PPF still follows the size rows", () => {
    expect(calculatePrice({ basePrice: 100000, serviceCategory: "ppf", vehicleCategory: "suv", vehicleCategoryPricing: sizeRows, ...tax }).subtotal).toBe(122500);
  });
  it("seeded non-PPF services carry no size surcharge rows", () => {
    for (const m of MENU_SEED) {
      const rows = sizePricingForCategory(m.category, m.rupees * 100);
      if (isSizePriced(m.category)) continue;
      expect(rows, m.name).toEqual([]);
    }
  });
  it("menu price text ignores size surcharges outside PPF", () => {
    const rupees = (p: number) => `Rs ${p / 100}`;
    const wash = menuPriceText({ category: "washing", basePrice: 90000, vehicleCategoryPricing: sizeRows }, "suv", rupees);
    expect(wash.text).toBe("Rs 900");
  });
});

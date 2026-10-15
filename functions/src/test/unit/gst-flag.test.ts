import { describe, it, expect } from "vitest";
import { GST_ENABLED } from "@autodeck/core";
import { calculatePrice, taxFor } from "../../lib/pricing.js";

// One switch (GST_ENABLED in packages/core). While it is false every price entry point must charge base + size adjustment only,
// whatever the studio settings say, so the figure a customer is shown is the figure that is booked and paid.
describe("GST switch", () => {
  it("is off for now", () => expect(GST_ENABLED).toBe(false));
  it("taxFor ignores studio settings while off", () => {
    expect(taxFor({ taxRatePercent: 18, taxDescription: "GST 18%" })).toEqual({ taxRatePercent: 0, taxDescription: "No tax" });
    expect(taxFor(null).taxRatePercent).toBe(0);
  });
  it("Foam wash on an SUV is 1,125 with no tax, from the studio config path too", () => {
    const pricing = [{ vehicleCategory: "suv" as const, additionalPricePaise: 22500, additionalMinutes: 0 }];
    const viaConfig = calculatePrice({ basePrice: 90000, vehicleCategory: "suv", vehicleCategoryPricing: pricing, ...taxFor({ taxRatePercent: 18, taxDescription: "GST 18%" }) });
    const viaDefault = calculatePrice({ basePrice: 90000, vehicleCategory: "suv", vehicleCategoryPricing: pricing, ...taxFor(null) });
    for (const b of [viaConfig, viaDefault]) { expect(b.tax).toBe(0); expect(b.total).toBe(112500); expect(b.total).toBe(b.subtotal); }
  });
});

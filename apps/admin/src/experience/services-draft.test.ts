import { describe, expect, it } from "vitest";
import { EMPTY_SERVICE, toServicePayload } from "./services-draft";

const base = { ...EMPTY_SERVICE, name: "Ceramic coat", priceRupees: "18450", minutes: "240" };

describe("toServicePayload", () => {
  it("converts rupees to paise", () => {
    const r = toServicePayload(base);
    expect(r.ok && r.payload.basePrice).toBe(1845000);
  });
  it("needs a positive price", () => expect(toServicePayload({ ...base, priceRupees: "0" }).ok).toBe(false));
  it("lifetime warranty carries no value", () => {
    const r = toServicePayload({ ...base, warrantyUnit: "lifetime", warrantyValue: "5" });
    expect(r.ok && [r.payload.warrantyDurationUnit, r.payload.warrantyDurationValue]).toEqual(["lifetime", null]);
  });
  it("timed warranty needs a whole number", () => expect(toServicePayload({ ...base, warrantyUnit: "years", warrantyValue: "" }).ok).toBe(false));
  it("rejects duplicate size rules", () => {
    const s = { vehicleCategory: "suv" as const, extraRupees: "500", extraMinutes: "30" };
    expect(toServicePayload({ ...base, sizes: [s, s] }).ok).toBe(false);
  });
  it("size rule extra price goes to paise", () => {
    const r = toServicePayload({ ...base, sizes: [{ vehicleCategory: "suv", extraRupees: "1500", extraMinutes: "45" }] });
    expect(r.ok && r.payload.vehicleCategoryPricing[0]).toEqual({ vehicleCategory: "suv", additionalPricePaise: 150000, additionalMinutes: 45 });
  });
});

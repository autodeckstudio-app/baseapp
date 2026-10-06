import { describe, expect, it } from "vitest";
import { resolvePricingCategory } from "./pricing-category.js";

describe("saved-car pricing category", () => {
  it.each([null, undefined, "", "legacy", 123])("keeps the visible default for %s", (value) => {
    expect(resolvePricingCategory(value, "hatchback")).toBe("hatchback");
    expect(resolvePricingCategory(value, "sedan")).toBe("sedan");
  });
  it.each(["hatchback", "sedan", "suv", "luxury", "van", "commercial"] as const)("accepts %s", (value) => {
    expect(resolvePricingCategory(value, "hatchback")).toBe(value);
  });
});

import { describe, expect, it } from "vitest";
import { stickyPriceLabel } from "./sticky-price";

const f = (p: number) => `Rs ${p / 100}`;
const base = { priceOnRequest: false, loading: false, total: null, from: false, needsCarType: false, hasCar: true, error: false };
describe("sticky price bar", () => {
  it("shows the price when loaded and never 'Pick your car size'", () => {
    expect(stickyPriceLabel({ ...base, total: 1875000 }, f)).toBe("Rs 18750");
    expect(stickyPriceLabel({ ...base, total: 1875000, from: true }, f)).toBe("From Rs 18750");
  });
  it("matches the price block for each non-price state", () => {
    expect(stickyPriceLabel({ ...base, needsCarType: true }, f)).toBe("Car type needed");
    expect(stickyPriceLabel({ ...base, needsCarType: true, hasCar: false }, f)).toBe("Add your car");
    expect(stickyPriceLabel({ ...base, error: true }, f)).toBe("Price unavailable");
    expect(stickyPriceLabel({ ...base, loading: true }, f)).toBe("Checking price");
    expect(stickyPriceLabel({ ...base, priceOnRequest: true }, f)).toBe("Consult");
    for (const s of [base, { ...base, error: true }, { ...base, needsCarType: true }]) expect(stickyPriceLabel(s, f)).not.toMatch(/size/i);
  });
});

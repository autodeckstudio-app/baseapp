import { describe, expect, it } from "vitest";
import type { Service } from "@autodeck/core";
import { calculatePrice, applyMembershipBenefit } from "../../lib/pricing.js";
import { addExtrasToBreakdown, extrasProblem, priceExtras, totalMinutes } from "../../lib/booking-lines.js";
import { createBookingSchema } from "../../schemas/booking.js";

const svc = (id: string, price: number, mins: number, over: Partial<Service> = {}): Service =>
  ({ id, name: id, tenantId: "t", basePrice: price * 100, estimatedDurationMinutes: mins, active: true, requiredBayType: "wash", vehicleCategoryPricing: [], ...over }) as unknown as Service;
const tax0 = { taxRatePercent: 0, taxDescription: "No tax" };

describe("booking lines", () => {
  const main = svc("wash", 900, 60);
  it("sums price and minutes, tax stays 0", () => {
    const bd = calculatePrice({ serviceCategory: "ppf", basePrice: main.basePrice, vehicleCategory: "sedan", vehicleCategoryPricing: [], ...tax0 });
    const lines = priceExtras([svc("polish", 1500, 45), svc("vac", 300, 15)], { vehicleCategory: "sedan", tax: tax0 });
    const out = addExtrasToBreakdown(bd, lines);
    expect(out.subtotal).toBe(270000);
    expect(out.tax).toBe(0);
    expect(out.total).toBe(270000);
    expect(out.addOns.map((a) => a.name)).toEqual(["polish", "vac"]);
    expect(totalMinutes(60, lines)).toBe(120);
  });
  it("applies size pricing per extra only for PPF", () => {
    const rows = [{ vehicleCategory: "suv", additionalPricePaise: 50000 }] as never;
    const e = svc("polish", 1500, 45, { category: "ppf" as never, vehicleCategoryPricing: rows });
    expect(priceExtras([e], { vehicleCategory: "suv", tax: tax0 })[0]!.price).toBe(200000);
    const flat = svc("polish", 1500, 45, { category: "washing" as never, vehicleCategoryPricing: rows });
    expect(priceExtras([flat], { vehicleCategory: "suv", tax: tax0 })[0]!.price).toBe(150000);
  });
  it("a wash credit covers only the main service", () => {
    const bd = applyMembershipBenefit(calculatePrice({ serviceCategory: "ppf", basePrice: main.basePrice, vehicleCategory: "sedan", vehicleCategoryPricing: [], ...tax0 }), { discountPercent: 0, consumeWash: true });
    const out = addExtrasToBreakdown(bd, priceExtras([svc("polish", 1500, 45)], { vehicleCategory: "sedan", tax: tax0 }));
    expect(out.membershipDiscount).toBe(90000);
    expect(out.total).toBe(150000);
  });
  it("recomputes tax on the unpaid part when tax is on", () => {
    const t = { taxRatePercent: 18, taxDescription: "GST 18%" };
    const bd = calculatePrice({ serviceCategory: "ppf", basePrice: 100000, vehicleCategory: "sedan", vehicleCategoryPricing: [], ...t });
    const out = addExtrasToBreakdown(bd, priceExtras([svc("x", 1000, 10)], { vehicleCategory: "sedan", tax: t }));
    expect(out.tax).toBe(36000);
    expect(out.total).toBe(236000);
  });
  it("rejects what cannot share a slot", () => {
    expect(extrasProblem(main, [svc("a", 1, 1, { requiredBayType: "garage" as never })], { gift: false })).toMatch(/different bays/);
    expect(extrasProblem(main, [svc("a", 1, 1, { priceOnRequest: true })], { gift: false })).toMatch(/after inspection/);
    expect(extrasProblem(main, [svc("a", 1, 1)], { gift: true })).toMatch(/gift/);
    expect(extrasProblem(main, [svc("wash", 1, 1)], { gift: false })).toMatch(/once/);
    expect(extrasProblem(main, [svc("a", 1, 1), svc("a", 1, 1)], { gift: false })).toMatch(/once/);
    expect(extrasProblem(main, ["a", "b", "c", "d", "e"].map((i) => svc(i, 1, 1)), { gift: false })).toMatch(/up to 5/);
    expect(extrasProblem(main, [svc("a", 1, 1, { active: false })], { gift: false })).toMatch(/not available/);
    expect(extrasProblem(main, [svc("a", 1, 1)], { gift: false })).toBeNull();
    expect(extrasProblem(main, [], { gift: true })).toBeNull();
  });
  it("old single-service payload still validates; extras cap at 4", () => {
    const base = { serviceId: "s", vehicleId: "v", vehicleCategory: "sedan", studioId: "st", scheduledDate: "2026-10-20", scheduledTime: "10:00", idempotencyKey: "k" };
    expect(createBookingSchema.safeParse(base).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...base, extraServiceIds: ["a"] }).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...base, extraServiceIds: ["a", "b", "c", "d", "e"] }).success).toBe(false);
  });
});

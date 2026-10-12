import { describe, expect, it } from "vitest";
import type { CarListingView } from "@autodeck/core";
import { gatePrice } from "../../functions/carsale/carsale";

const v = { id: "c1", askingPrice: 111100000 } as CarListingView;
describe("gatePrice", () => {
  it("hides the price from a customer who has not asked", () => {
    const g = gatePrice(v, { role: "customer", uid: "u1", sellerId: "other", asked: new Set() });
    expect(g.askingPrice).toBe(0); expect(g.priceHidden).toBe(true);
  });
  it("shows it after an interest request for that car only", () => {
    expect(gatePrice(v, { role: "customer", uid: "u1", sellerId: "other", asked: new Set(["c1"]) }).askingPrice).toBe(111100000);
    expect(gatePrice(v, { role: "customer", uid: "u1", sellerId: "other", asked: new Set(["c2"]) }).priceHidden).toBe(true);
  });
  it("shows it to the seller and to staff", () => {
    expect(gatePrice(v, { role: "customer", uid: "u1", sellerId: "u1", asked: new Set() }).askingPrice).toBe(111100000);
    expect(gatePrice(v, { role: "admin", uid: "a", sellerId: "x", asked: new Set() }).askingPrice).toBe(111100000);
  });
});

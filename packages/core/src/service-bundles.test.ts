import { describe, expect, it } from "vitest";
import { MENU_SEED, sizePricingFor } from "./menu";
import { SERVICE_INCLUDES } from "./service-bundles";
import type { VehicleCategory } from "./index";

const CATS: VehicleCategory[] = ["hatchback", "sedan", "suv", "luxury", "commercial", "van"];
const priceFor = (id: string, cat: VehicleCategory): number => {
  const m = MENU_SEED.find((x) => x.id === id);
  if (!m) throw new Error(`menu has no ${id}`);
  const extra = sizePricingFor(m.rupees * 100).find((x) => x.vehicleCategory === cat)?.additionalPricePaise ?? 0;
  return m.rupees * 100 + extra;
};

describe("a bundle never costs more than its parts, for any car size", () => {
  for (const [big, parts] of Object.entries(SERVICE_INCLUDES)) {
    for (const cat of CATS) {
      it(`${big} <= sum of parts for ${cat}`, () => {
        expect(priceFor(big, cat)).toBeLessThanOrEqual(parts.reduce((t, p) => t + priceFor(p, cat), 0));
      });
    }
  }
  it("Full detail wash is the owner's price: Rs 5,750 for a hatchback, parts Rs 1,500 + Rs 4,500", () => {
    expect(priceFor("menu-wash-full", "hatchback")).toBe(575000);
    expect(priceFor("menu-wash-exterior", "hatchback") + priceFor("menu-wash-interior", "hatchback")).toBe(600000);
  });
});

import { conflictingPair } from "./service-bundles";
describe("services that cannot be booked together (owner relay, 18 Oct 6:26 PM)", () => {
  it("foam with exterior or full; two ceramics; two PPF; not a coating with its add-on", () => {
    expect(conflictingPair(["menu-wash-foam", "menu-wash-exterior"])).not.toBeNull();
    expect(conflictingPair(["menu-wash-full", "menu-wash-foam"])).not.toBeNull();
    expect(conflictingPair(["menu-coat-autodeck-1", "menu-coat-autodeck-2"])).not.toBeNull();
    expect(conflictingPair(["menu-ppf-xpel-full-front", "menu-ppf-3m-high-impact"])).not.toBeNull();
    expect(conflictingPair(["menu-coat-fireball-1", "menu-coat-glass"])).toBeNull();
    expect(conflictingPair(["menu-wash-foam", "menu-wash-interior"])).toBeNull();
  });
});

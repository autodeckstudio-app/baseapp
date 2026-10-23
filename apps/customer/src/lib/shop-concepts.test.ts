// Track B (fresh recovery): the concept catalogue is browse-only and truthful.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SHOP_CONCEPTS } from "@autodeck/core";

const route = readFileSync(`${__dirname}/../app/shop.tsx`, "utf8");

describe("shop concept catalogue", () => {
  it("holds 12 concepts across the three site departments", () => {
    expect(SHOP_CONCEPTS).toHaveLength(12);
    for (const d of ["Scent", "Clothing", "Car accessories"]) {
      expect(SHOP_CONCEPTS.some((c) => c.department === d)).toBe(true);
    }
  });
  it("no concept carries a price", () => {
    for (const c of SHOP_CONCEPTS) expect(c).not.toHaveProperty("pricePaise");
  });
  it("limited drops are excluded from department chips (All only)", () => {
    const drops = SHOP_CONCEPTS.filter((c) => c.limited);
    expect(drops.length).toBeGreaterThan(0);
    expect(route).toContain('!c.limited && (dept === "All" || c.department === dept)');
    expect(route).toContain('dept === "All" ? SHOP_CONCEPTS.filter((c) => c.limited) : []');
  });
  it("caps file under Clothing but read Objects on the tile", () => {
    const caps = SHOP_CONCEPTS.filter((c) => c.id.startsWith("concept-cap"));
    expect(caps.length).toBe(2);
    for (const c of caps) { expect(c.department).toBe("Clothing"); expect(c.label).toBe("Objects"); }
  });
  it("the route marks every tile Concept and never orders", () => {
    expect(route).toContain("CONCEPT");
    expect(route).toContain("Not available to order yet");
    expect(route).toContain("No price yet.");
    expect(route).not.toContain("Place order");
    expect(route).not.toContain("pricePaise");
  });
});

import { describe, expect, it } from "vitest";
import { createPriceCache } from "./price-cache";

describe("held price totals", () => {
  it("are reused only for the same user, service and car size", () => {
    const c = createPriceCache(() => 0);
    c.set("u1", "ppf", "suv", 1875000);
    expect(c.get("u1", "ppf", "suv")).toBe(1875000);
    expect(c.get("u1", "ppf", "hatchback")).toBeUndefined();
    expect(c.get("u2", "ppf", "suv")).toBeUndefined();
    expect(c.get("u1", "other", "suv")).toBeUndefined();
    expect(c.get(null, "ppf", "suv")).toBeUndefined();
  });
  it("expire after 5 minutes", () => {
    let t = 0;
    const c = createPriceCache(() => t);
    c.set("u1", "ppf", "suv", 100);
    t = 5 * 60_000 - 1;
    expect(c.get("u1", "ppf", "suv")).toBe(100);
    t = 5 * 60_000;
    expect(c.get("u1", "ppf", "suv")).toBeUndefined();
  });
  it("can be cleared", () => {
    const c = createPriceCache(() => 0);
    c.set("u1", "ppf", "suv", 100);
    c.clear();
    expect(c.get("u1", "ppf", "suv")).toBeUndefined();
  });
});

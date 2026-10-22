import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SHOP_FIXTURE } from "./shop-fixture";
describe("shop fixture identity", () => {
  it("web and app fixture describe the same product", () => {
    const web = JSON.parse(readFileSync(new URL("../../../apps/site/src/data/shop-fixture.json", import.meta.url), "utf8")).products[0];
    const app = SHOP_FIXTURE.products[0];
    if (!app) throw new Error("shop fixture has no products");
    expect(app.id).toBe(web.id);
    expect(app.name).toBe(web.name);
    expect(app.pricePaise).toBe(web.pricePaise);
    expect(app.variants).toEqual(web.variants);
    expect(app.fixture).toBe(true);
  });
});

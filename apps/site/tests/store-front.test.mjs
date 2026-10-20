import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
test("departments come first as three tiles, ahead of the collection", () => {
  const x = read("src/pages/shop.astro");
  for (const d of ["Scent", "Clothing", "Car accessories"]) assert.match(x, new RegExp(`data-department="${d}"`));
  assert.ok(x.indexOf("store-departments") < x.indexOf('id="collection"'));
  assert.doesNotMatch(x, /edition-statement|store-promise|store-bar|store-filters/);
});
test("no dummy controls, no prices, no products on the store", () => {
  const x = read("src/pages/shop.astro");
  assert.doesNotMatch(x, /type="search"|<select|cart|checkout|Add to bag|price/i);
  assert.deepEqual(JSON.parse(read("src/data/shop.json")).products, []);
});
test("store says plainly it is not taking orders", () => {
  assert.match(read("src/pages/shop.astro"), /Not taking orders yet/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("store has a storefront bar and the three departments Meet named, with no dummy controls", () => {
  const x = read("src/pages/shop.astro");
  assert.match(x, /class="store-bar"/);
  for (const d of ["Scent", "Clothing", "Car accessories"]) assert.match(x, new RegExp(`data-store-filter=\\{d\\}|data-department="${d}"`));
  assert.match(x, /Car accessories/);
  // no controls that would do nothing: search, sort, cart, checkout
  assert.doesNotMatch(x, /type="search"|<select|cart|checkout|Add to bag/i);
});
test("store shows a price only when a real product supplies one, and ships no products", () => {
  const x = read("src/pages/shop.astro");
  assert.match(x, /typeof p\.price === 'number'/);
  assert.deepEqual(JSON.parse(read("src/data/shop.json")).products, []);
});
test("the department filter pills wrap on phones instead of overflowing", () => {
  assert.match(read("src/styles/store.css"), /max-width:560px\)\{\.store-filters\{flex-wrap:wrap/);
});

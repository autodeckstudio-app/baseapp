import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
test('no fabricated launch products or edition',()=>{const d=JSON.parse(read('src/data/shop.json'));assert.deepEqual(d.products,[]);assert.equal(d.edition,null);assert.deepEqual(JSON.parse(read('src/data/merch.json')),[]);});
test('Store and homepage no longer sell logo concepts',()=>{for(const file of ['src/pages/shop.astro','src/pages/index.astro'])assert.doesNotMatch(read(file),/Studio Tee|Shield Cap|Care Kit|<ProductArt|Placeholder illustration/);});
test('filter and quick view structure is accessible and truthful',()=>{const x=read('src/pages/shop.astro');assert.match(x,/Nothing is available to order yet/);assert.match(x,/<dialog/);assert.match(x,/aria-labelledby/);assert.match(x,/<noscript>/);assert.doesNotMatch(x,/Add to cart|Buy now|Sold out|Limited edition|Only \d/);});
test('interaction has reduced-motion and safe native dialog',()=>{const x=read('src/scripts/store.js');assert.match(x,/prefers-reduced-motion: reduce/);assert.match(x,/showModal\(\)/);assert.match(x,/dialog.close\(\)/);assert.doesNotMatch(x,/innerHTML/);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('car mode actions remain functional and availability meaning remains visible',()=>{const h=read('dist/cars/index.html');assert(h.includes('cars-mode-switch'));assert(h.includes('data-cars-tab="buy"'));assert(h.includes('data-cars-tab="sell"'));assert(h.includes('Availability may change. Details in app.'));assert(h.includes('View all cars in the app'));assert(h.includes('Continue in the app'))});

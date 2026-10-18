import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePublicCars } from '../src/data/public-cars.mjs';
const source = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('no invented public cars',()=>assert.deepEqual(validatePublicCars(JSON.parse(source('src/data/cars.json'))),[]));
test('private fields are rejected, not hidden',()=>{for(const field of ['price','askingPrice','plate','registrationNumber','owner','owners','sellerName','sellerPhone','description','adminNotes','photoUrls'])assert.throws(()=>validatePublicCars([{[field]:'private'}]),/Not an allowed public/);});
test('photo requires safe local path and explicit redaction approval',()=>{const base={id:'unit',make:'Make',model:'Model',photo:'/assets/inventory/unit.webp',photoAlt:'Approved car photograph'};assert.throws(()=>validatePublicCars([base]),/approval/);assert.throws(()=>validatePublicCars([{...base,publicPhotoApproved:true,photo:'https://example.com/original.jpg'}]),/approved local/);assert.equal(validatePublicCars([{...base,publicPhotoApproved:true}]).length,1);});
test('plate-like identifiers rejected from safe text',()=>assert.throws(()=>validatePublicCars([{id:'unit',make:'Make',model:'MH 02 AB 1234',photo:'/assets/inventory/unit.webp',photoAlt:'Car',publicPhotoApproved:true}]),/identifier/));
test('no public raw listing API or stock imagery',()=>{const p=source('src/pages/cars.astro');assert.doesNotMatch(p,/stock-water|stock-blackcar|askingPrice|sellerName|registrationNumber/);assert.match(p,/https:\/\/app.autodeck.in/);assert.match(p,/No cars are listed on this page yet/);});

test('Cars page reads the public listing endpoint, spec text only: no photo, price, plate or area', () => {
  const src = readFileSync(new URL('../src/pages/cars.astro', import.meta.url), 'utf8');
  assert.ok(src.includes('listPublicCarListings'));
  const script = src.slice(src.indexOf('<script is:inline>'));
  assert.ok(script.includes('textContent'));
  assert.ok(!/innerHTML|\.area|price|photoUrls|registration/i.test(script.replace('Price requests continue in the app.', '').replace('for price and details', '')));
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('five service homes, compatible leaf URLs and exact offering handoffs never auto-book',()=>{
 const index=read('dist/services/index.html');
 const cards=[...index.matchAll(/class="service-preview-card[^>]+href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(cards,['/services/paint-protection','/services/detailing','/services/washing','/services/garage','/services/modifications']);
 for(const slug of ['paint-protection','ceramic-coating','detailing','washing','garage','modifications']){
  const h=read('dist/services/'+slug+'/index.html');assert(h.includes('https://app.autodeck.in/catalogue'));assert(!/href="[^"]*\/book\//.test(h));
  assert(!h.includes('data-offering-id'));assert(!/href="https:\/\/app.autodeck.in\/catalogue\//.test(h));
 }
 const paint=read('dist/services/paint-protection/index.html');assert(paint.includes('Ceramic coating'));assert(!paint.includes('cat=ppf'));assert(!paint.includes('/catalogue/enquiry'));assert(paint.includes('PPF installation and PPS are not listed as available offerings here.'));
 const js=read('src/scripts/redesign.ts');assert(js.includes("link.href=categoryLink||'https://app.autodeck.in/'"));assert(js.includes('Continue to the matching service category'));assert(!js.includes('Your choice is not automatically passed'));
});

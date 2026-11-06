import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('packages/core/src/customer-offering-visibility.json',root),'utf8'));
const source=fs.readFileSync(new URL('packages/core/src/customer-offering-visibility.ts',root),'utf8').replace(/import visibility[^;]+;/,'').replace('new Set<string>','new Set');
const script=source.replace('export ','').replace('row: { id?: string; key?: string; active?: boolean; brand?: string | null }','row').replace('): boolean',')');
const ctx=vm.createContext({visibility:manifest});vm.runInContext(script,ctx);
test('only held offering is hidden; other brands and records survive',()=>{
 const fn=ctx.customerOfferingVisible;
 assert.equal(fn({id:'svc_852ed684301e188f572797265d7b106e'}),false);
 assert.equal(fn({brand:'Keramik',id:'keramik-coating'}),false);
 assert.equal(fn({id:'unknown',brand:'Fireball'}),false);
 for(const id of [...manifest.confirmedProductIds,...manifest.ordinaryServiceIds])assert.equal(fn({id}),true);
 for(const id of manifest.confirmedProductIds)assert.equal(fn({id,active:false}),false);
});
test('cached, fetched and mock catalogue all pass same hold; direct enquiry is filtered',()=>{
 const catalogue=fs.readFileSync(new URL('apps/customer/src/lib/catalogue-service.ts',root),'utf8');
 assert.match(catalogue,/previewEligible=.*customerOfferingVisible\(row\)/);
 assert.equal((catalogue.match(/filter\(previewEligible\)/g)||[]).length,3);
 const refs=fs.readFileSync(new URL('apps/customer/src/lib/brand-enquiries.ts',root),'utf8');
 assert.match(refs,/filter\(customerOfferingVisible\)/);
 const detail=fs.readFileSync(new URL('apps/customer/src/app/(tabs)/catalogue/[id].tsx',root),'utf8');
 assert.match(detail,/customerOfferingVisible\(\{id\}\)/);
 assert.match(detail,/active === true && customerOfferingVisible/);
 const booking=fs.readFileSync(new URL('apps/customer/src/app/(tabs)/book/[serviceId].tsx',root),'utf8');
 assert.match(booking,/customerOfferingVisible\(\{id:serviceId\}\)/);
 assert.match(booking,/s.active === true && customerOfferingVisible\(s\)/);
 assert.match(booking,/!selectedCategory \|\| !customerOfferingVisible\(\{id:serviceId\}\) \|\| !service \|\| !customerOfferingVisible\(service\)/);
 assert.match(booking,/\[serviceId, selectedCategory, service\]/);
});

test('site hides exact held named service and its reference without changing shared data',()=>{
 const site=fs.readFileSync(new URL('apps/site/src/pages/services/[slug].astro',root),'utf8');
 assert.match(site,/catalogue.services.filter\(customerOfferingVisible\)/);
 assert.match(site,/askRanges=enquiries.filter\(s=>customerOfferingVisible\(s\)/);
});

test('all raw reference and live package identities obey confirmation guard',()=>{const fn=ctx.customerOfferingVisible;const refs=JSON.parse(fs.readFileSync(new URL('packages/core/src/brand-enquiries.json',root)));assert.equal(refs.filter(fn).length,9);for(const ref of refs)assert.equal(fn(ref),manifest.confirmedEnquiryKeys.includes(ref.key));for(const brand of ['garware','xpel','llumar','3m'])for(const coverage of ['high-impact','full-front','full-body'])assert.equal(fn({id:`menu-ppf-${brand}-${coverage}`}),false);assert.equal(fn({id:'menu-ppf-colour'}),false);assert.equal(fn({key:'pps-spray'}),false);assert.equal(fn({id:'unknown-new-product'}),false);});

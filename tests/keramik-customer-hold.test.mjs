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

test('site carries no Keramik reference while the identity hold stands',()=>{
 const site=JSON.parse(fs.readFileSync(new URL('apps/site/src/data/brand-enquiries.json',root),'utf8'));
 assert(!site.some(x=>/keramik/i.test(x.brand??'')||/keramik/i.test(x.key)));
 const customer=JSON.parse(fs.readFileSync(new URL('packages/core/src/brand-enquiries.json',root),'utf8'));
 for(const ref of customer.filter(x=>/keramik/i.test(x.brand??'')||/keramik/i.test(x.key)))assert.equal(ctx.customerOfferingVisible(ref),false);
});

test('all raw reference and live package identities obey confirmation guard',()=>{const fn=ctx.customerOfferingVisible;const refs=JSON.parse(fs.readFileSync(new URL('packages/core/src/brand-enquiries.json',root)));assert.equal(refs.filter(fn).length,17);for(const ref of refs)assert.equal(fn(ref),manifest.confirmedEnquiryKeys.includes(ref.key));for(const brand of ['garware','xpel','llumar','3m'])for(const coverage of ['high-impact','full-front','full-body'])assert.equal(fn({id:`menu-ppf-${brand}-${coverage}`}),false);assert.equal(fn({id:'menu-ppf-colour'}),false);assert.equal(fn({key:'pps-spray'}),true);for(const key of ['llumar-ppf','garware-ppf','xpel-ppf','avery-dennison-ppf','avvyx-ppf','nar-ppf','gswf-ppf'])assert.equal(fn({key}),true);for(const key of ['xpel-ultimate-plus','ultraguard-clear-ppf','gswf-0','garware-premium-exact','nar-m1','avvyx-0'])assert.equal(fn({key}),false);for(const key of ['garware-black-ppf','garware-white-ppf','llumar-select-black-ppf'])assert.equal(fn({key}),false);for(const key of ['avery-reference','suntek-reference'])assert.equal(fn({key}),false);assert.equal(fn({id:'unknown-new-product'}),false);});

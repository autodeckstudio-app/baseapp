import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('apps/customer/src/lib/customer-offering-visibility.ts',root),'utf8');
const script=source.replace('export ','').replace('row: { id?: string; brand?: string | null }','row').replace('): boolean',')');
const ctx=vm.createContext({});vm.runInContext(script,ctx);
test('only held offering is hidden; other brands and records survive',()=>{
 const fn=ctx.customerOfferingVisible;
 assert.equal(fn({id:'svc_852ed684301e188f572797265d7b106e'}),false);
 assert.equal(fn({brand:'Keramik',id:'keramik-coating'}),false);
 for(const brand of ['Fireball','Kovalent','CarPro','3M',null])assert.equal(fn({id:'other',brand}),true);
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
 assert.match(booking,/serviceSnap.data\(\).active === true && customerOfferingVisible\(serviceSnap.data\(\) as Service\)/);
 assert.match(booking,/!selectedCategory \|\| !customerOfferingVisible\(\{id:serviceId\}\) \|\| !service \|\| !customerOfferingVisible\(service\)/);
 assert.match(booking,/\[serviceId, selectedCategory, service\]/);
});

test('site hides exact held named service and its reference without changing shared data',()=>{
 const site=fs.readFileSync(new URL('apps/site/src/pages/services/[slug].astro',root),'utf8');
 assert.match(site,/row.id!==.svc_852ed684301e188f572797265d7b106e.&&row.brand!==.Keramik./);
 assert.match(site,/askRanges=enquiries.filter\(s=>s.brand!==.Keramik./);
});

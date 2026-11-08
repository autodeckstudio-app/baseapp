import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=new URL('../',import.meta.url);const data=JSON.parse(fs.readFileSync(new URL('packages/core/src/customer-offering-visibility.json',root)));
const SITE_KEYS=['avery-dennison-ppf','avvyx-ppf','garware-ppf','gswf-ppf','llumar-ppf','nar-ppf','xpel-ppf'];
test('confirmed product and ordinary service boundaries are explicit and unique',()=>{assert.equal(data.confirmedProductIds.length,42);assert.equal(data.ordinaryServiceIds.length,23);assert.equal(data.confirmedEnquiryKeys.length,17);assert.equal(new Set([...data.confirmedProductIds,...data.ordinaryServiceIds]).size,65);for(const id of [...data.confirmedProductIds,...data.ordinaryServiceIds])assert(!id.startsWith('menu-ppf-'));});
test('shared and site reference records are retained without deletion',()=>{assert(JSON.parse(fs.readFileSync(new URL('packages/core/src/brand-enquiries.json',root))).length>=38);const site=JSON.parse(fs.readFileSync(new URL('apps/site/src/data/brand-enquiries.json',root)));assert.equal(site.length,SITE_KEYS.length);});
test('customer references are retained only for exact confirmed products; ceramic customer-only keys stay off the site',()=>{const customer=JSON.parse(fs.readFileSync(new URL('packages/core/src/brand-enquiries.json',root)));const site=JSON.parse(fs.readFileSync(new URL('apps/site/src/data/brand-enquiries.json',root)));assert.equal(customer.filter(x=>data.confirmedEnquiryKeys.includes(x.key)).length,17);for(const key of data.confirmedEnquiryKeys){const ref=customer.find(x=>x.key===key);assert(ref);}const customerOnly=['koch-chemie-ceramic-allround-c0-02','koch-chemie-ceramic-body-cb0-01','koch-chemie-ceramic-neo-c0-03','koch-chemie-ceramic-rims-cr0-01','kovalent-fabric','kovalent-matrix','kovalent-matte','kovalent-overlay','kovalent-prolong-light'];for(const key of customerOnly)assert(!site.some(x=>x.key===key));});
test('unconfirmed product type fallbacks do not remain enquiry offers',()=>{const tree=fs.readFileSync(new URL('apps/customer/src/lib/services-tree.ts',root),'utf8');assert(tree.includes("d.enquiryOnly && group.key !== 'ppf' && group.key !== 'coatings'"));});
test('website visibility is its own explicit reviewed list and cannot follow the customer manifest',()=>{
 // The site publishes exactly this reviewed set of enquiry records; adding or
 // dropping a brand or range on the website requires a deliberate edit of this list.
 const site=JSON.parse(fs.readFileSync(new URL('apps/site/src/data/brand-enquiries.json',root)));
 assert.deepEqual(site.map(x=>x.key).sort(),SITE_KEYS);
 // No site source may read the shared hold manifest or the core package, so a
 // customer-app visibility change can never silently change the website.
 const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):/\.(ts|tsx|astro|js|mjs)$/.test(e.name)?[path.join(d,e.name)]:[]);
 for(const f of walk(new URL('apps/site/src',root).pathname)){const src=fs.readFileSync(f,'utf8');assert(!src.includes('customer-offering-visibility'),f);assert(!src.includes('@autodeck/core'),f);}
});

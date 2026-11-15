import{it,expect}from'vitest';import{readFileSync}from'node:fs';import{BRAND_ENQUIRIES}from'./brand-enquiries';import{referencePlacement,servicePlacement}from'./services-navigation';import{devCatalogueSeed}from'./catalogue-dev-sample';import canonical from'../../../../packages/core/src/public-service-catalogue.json';
it('audits actual local catalogue detailing families against explicit semantic image coverage',()=>{
 const found=[...new Set([...canonical.services.map(s=>servicePlacement(s as never)),...devCatalogueSeed.map(s=>servicePlacement(s as never)),...BRAND_ENQUIRIES.map(r=>referencePlacement(r))].filter(x=>x?.home==='detailing').map(x=>x!.family))].sort();
 const expected=['Fabric','Film aftercare','Glass','Leather','Lights & plastics','Maintenance','Paint sealant','Trim restoration','Tyres & rubber','Wheels & trim'].sort();expect(found).toEqual(expected);
 const src=readFileSync('src/lib/service-type-images.ts','utf8');for(const name of expected)expect(src).toMatch(new RegExp('(?:"'+name.replace('&','&')+'"|'+name+')\\s*:'));
});

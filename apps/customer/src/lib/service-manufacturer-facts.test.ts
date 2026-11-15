import{it,expect}from'vitest';
import{devCatalogueSeed}from'./catalogue-dev-sample';
import{customerOfferingVisible}from'./customer-offering-visibility';
import{serviceManufacturerFacts}from'./service-manufacturer-facts';
import{BRAND_ENQUIRIES}from'./brand-enquiries';
import{referenceManufacturerFacts}from'./reference-manufacturer-facts';
it('has an exact official product match for every currently visible branded sample product',()=>{const visible=devCatalogueSeed.filter(customerOfferingVisible);expect(visible).toHaveLength(42);for(const s of visible){const facts=serviceManufacturerFacts(s);expect(facts,s.name).not.toBeNull();expect(facts!.rows.slice(0,3).map(r=>r.label),s.name).toEqual(['What it is','What it does','Where it applies']);expect(facts!.highlights?.length,s.name).toBeGreaterThan(0);expect(facts!.surfaces?.length,s.name).toBeGreaterThan(0);expect(facts!.source).toMatch(/^https:\/\//);expect(JSON.stringify(facts)).not.toMatch(/per brand|Special order|stock|studio confirms/);}});
it('does not guess product versions or match fragments',()=>{for(const name of['CarPro CQUARTZ DLUX 3.0','CarPro CQUARTZ Skin Plus','Gtechniq C1 Unknown'])expect(serviceManufacturerFacts({name,brand:name.split(' ')[0]!})).toBeNull()});
it('keeps existing visibility and leaves unidentified PPS facts absent rather than invented',()=>{expect(BRAND_ENQUIRIES).toHaveLength(18);for(const item of BRAND_ENQUIRIES)if(item.key!=='pps-spray')expect(referenceManufacturerFacts(item),item.key).not.toBeNull();else expect(referenceManufacturerFacts(item)).toBeNull()});

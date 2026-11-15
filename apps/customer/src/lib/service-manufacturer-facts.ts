import type {Service} from '@autodeck/core';
import entries from './service-manufacturer-facts.json';
import {referenceManufacturerFacts,type ManufacturerFacts} from './reference-manufacturer-facts';
/** Exact brand + full product name only. Similar names and new versions never inherit facts. */
export function serviceManufacturerFacts(s:Pick<Service,'name'|'brand'>):ManufacturerFacts|null{
 if(!s.brand)return null;
 const name=s.name.startsWith(s.brand+' ')?s.name.slice(s.brand.length+1):s.name;
 const direct=entries.find(x=>x.brand===s.brand&&x.names.includes(name));
 if(direct)return {source:direct.source,rows:direct.rows,...("highlights" in direct?{highlights:direct.highlights as NonNullable<ManufacturerFacts["highlights"]>}:{}),...("surfaces" in direct?{surfaces:direct.surfaces as string[]}: {})};
 return referenceManufacturerFacts({key:'',name,brand:s.brand,group:'coatings',note:''});
}

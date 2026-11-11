import type { Service } from '@autodeck/core';
import { showcaseFor } from './showcase';
/** Presentation only. Every item retains the catalogue's verb, qualifiers and scope. */
export function serviceScopeItems(service: Pick<Service,'name'|'description'|'category'>): string[] {
 const source=showcaseFor(service).included;
 // Product disclosures already use structured manufacturer/catalogue rows.
 if(['ceramic','ppf','coating'].includes(service.category))return source;
 const out=source.flatMap(line=>{
  const inspection=/^(.+) checked and reported\.$/.exec(line);
  if(inspection)return inspection[1]!.split(/,\s*|\s+and\s+/).filter(Boolean).map(area=>`${area.charAt(0).toUpperCase()+area.slice(1)} checked and reported`);
  const exact:Record<string,string[]>={
   'Cooling performance, gas level and leak check.':['Cooling performance check','Gas level check','Leak check'],
   'Battery health, terminals and charging system test.':['Battery health test','Terminals test','Charging system test'],
   'Four-wheel alignment and balancing.':['Four-wheel alignment','Balancing'],
   'Interior deep clean and exterior detail wash together.':['Interior deep clean','Exterior detail wash'],
   'Vacuum, steam clean and conditioning of seats, mats and trim.':['Vacuum','Steam clean','Conditioning of seats, mats and trim'],
   'Headlight restoration and buffing.':['Headlight restoration','Headlight buffing'],
   'Standard exterior wash and dry with foam.':['Exterior foam wash','Exterior drying'],
  };
  if(exact[line])return exact[line]!;
  return line.split(/(?<=[.!?])\s+(?=[A-Z])/).map(x=>x.trim()).filter(Boolean);
 });
 return [...new Set(out)];
}

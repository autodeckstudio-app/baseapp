import type {Service} from '@autodeck/core';
import {servicePlacement} from './services-navigation';
export type DetailingService = {key:string;title:string;family:string;primary:Service;options:Service[]};
/** Display only: variants keep their original price, eligibility and booking ID.
 * Only the reviewed Wheels pair groups multiple Standard records. */
export function detailingServices(services:readonly Service[]):DetailingService[]{
 const rows=services.filter(s=>s.active&&servicePlacement(s)?.home==='detailing');
 const families=[...new Set(rows.map(s=>servicePlacement(s)!.family))];
 return families.flatMap(family=>{
  const items=rows.filter(s=>servicePlacement(s)!.family===family);
  const standard=items.filter(s=>!s.brand||s.brand==='Standard'||s.brand==='Add-ons');
  if(standard.length===0){const primary=items[0]!;return [{key:primary.id,title:family,family,primary,options:items}];}
  if(standard.length===1||(family==='Wheels & trim'&&items.every(s=>['menu-coat-wheels','svc_c2f74071fe48615845d9b26f6be63d22'].includes(s.id)))){const primary=standard[0]!;return [{key:primary.id,title:primary.name,family,primary,options:[primary,...items.filter(s=>s.id!==primary.id)]}];}
  // No ungrounded association between different jobs sharing a surface family.
  return items.map(primary=>({key:primary.id,title:primary.name,family,primary,options:[primary]}));
 });
}
export function detailingServiceFor(service:Service,services:readonly Service[]):DetailingService|undefined{return detailingServices(services).find(g=>g.options.some(s=>s.id===service.id));}
export function detailingOptionLabel(service:Service):string{if(service.id==='svc_c2f74071fe48615845d9b26f6be63d22')return 'Spray';return !service.brand||service.brand==='Standard'||service.brand==='Add-ons'?'Standard':service.brand;}

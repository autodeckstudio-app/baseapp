import {selectionScopeIssue,duplicateWash,type DuplicateWash,type Service} from '@autodeck/core';
import {detailingServiceFor} from './detailing-services';

/** Existing Customer cart rules, shared by the journey and its offline design preview.
 * Selection is intent only. This helper never prices, books, persists or submits work.
 */
export function isCartEligible(s:Service):boolean{return s.active&&!s.customerMenu?.bookingMode&&!s.priceOnRequest&&s.basePrice>0&&(s.estimatedDurationMinutes>0||['ceramic','ppf'].includes(s.category));}
export type CartSelection={ids:readonly string[];toggle:(id:string)=>boolean};
export function cartSelectionState(services:readonly Service[],ids:readonly string[]){
 const selected=ids.map(id=>services.find(s=>s.id===id)).filter((s):s is Service=>!!s&&isCartEligible(s));
 return{selected,invalidSelection:selected.length!==ids.length,scopeIssue:selectionScopeIssue(selected),
  // From the Admin-published flags only (standaloneExteriorWash / includesExteriorWash); never from names or categories.
  duplicateWash:duplicateWash(selected)};
}
/** "Yes, remove extra Wash": deselects only the standalone paid Wash lines the prompt named. Every other line stays,
 *  and the cart price and availability are recalculated from the new selection. Only called on the customer's choice;
 *  a paid service is never removed silently. Returns the removed ids. */
export function removeStandaloneWash(selection:CartSelection,d:DuplicateWash):string[]{
 const removed:string[]=[];for(const id of d.standaloneWashIds)if(selection.ids.includes(id)&&selection.toggle(id))removed.push(id);return removed;
}
export function toggleCartService(s:Service,services:readonly Service[],selection:CartSelection):{ok:boolean;error:string|null;replacedIds:string[]}{
 if(!services.some(row=>row.id===s.id)||!isCartEligible(s))return{ok:false,error:'This option is not eligible for direct cart selection. Open its service details.',replacedIds:[]};
 const ids=selection.ids,{selected}=cartSelectionState(services,ids);const replacedIds:string[]=[];
 if(!ids.includes(s.id)){
  const choice=detailingServiceFor(s,services);const alternatives=choice?.options.filter(x=>x.id!==s.id).map(x=>x.id)??[];
  const problem=selectionScopeIssue([...selected.filter(x=>!alternatives.includes(x.id)),s]);
  if(problem)return{ok:false,error:problem,replacedIds:[]};
  for(const id of alternatives)if(ids.includes(id)){selection.toggle(id);replacedIds.push(id)}
 }
 const ok=selection.toggle(s.id);
 return{ok,error:ok?null:'Choose up to five services. Remove one before adding another.',replacedIds};
}

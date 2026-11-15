import{reviewPerformedWork,workProjection,type WorkLedger,type WorkScope,type ApprovedTerm,type LifecycleTarget}from'./performed-work.js';
export type CoverageEvidence={lineId:string;productId:string;coverage:string;termId:string|null;termVersion:number|null;registration:'not_confirmed'|'confirmed'|'not_required';eligibility:'not_confirmed'|'eligible'|'needs_review';sourceUrl:string|null};
export type WorkCoverageViewItem={id:string;title:string;product:string|null;coverage:string|null;performedAt:string|null;workStatus:'Not recorded'|'Needs QC'|'QC recorded'|'Needs review';terms:'not_confirmed'|'confirmed';registration:CoverageEvidence['registration'];eligibility:CoverageEvidence['eligibility'];termLabel?:string;sourceLabel?:string;performedBy?:string|null;qcBy?:string|null};
// Source and current scope are supplied by a trusted server adapter, not UI input.
// This is a read projection only: no warranty is issued or term inferred.
export function buildWorkCoverageView(ledger:WorkLedger,current:{scope:WorkScope;vehicleActive:boolean;terms:ApprovedTerm[];targets:LifecycleTarget[]},evidence:CoverageEvidence[],products:Record<string,string>,audience:'customer'|'studio'|'admin'):WorkCoverageViewItem[]{
 const issues=reviewPerformedWork(ledger,current),base=workProjection(ledger,issues,audience);
 return base.items.map(item=>{const facts=ledger.facts.filter(f=>f.lineId===item.lineId),fact=facts.length===1?facts[0]:undefined;const candidates=evidence.filter(e=>e.lineId===item.lineId);const e=candidates.length===1?candidates[0]:undefined;
 const exact=!!e&&!!fact&&fact.action!=='remove'&&fact.productId===item.productId&&e.productId===fact.productId&&e.coverage===fact.coverage&&fact.warranty.kind==='terms'&&fact.warranty.id===e.termId&&fact.warranty.version===e.termVersion;
 const termsForItem=exact?current.terms.filter(t=>t.id===e.termId&&t.version===e.termVersion&&t.productId===e.productId&&t.coverage===e.coverage):[];const term=termsForItem.length===1?termsForItem[0]:undefined;
 let source:string|undefined;try{if(e?.sourceUrl&&new URL(e.sourceUrl).toString().startsWith('https:'))source=e.sourceUrl}catch{}
 const terms=!!term?.text.trim()&&!!term.label.trim()&&!!source;
 const validDate=!!fact?.performedAt&&!Number.isNaN(Date.parse(fact.performedAt));
 return{id:item.lineId,title:item.title,product:item.productId?products[item.productId]??null:null,coverage:item.coverage,performedAt:validDate?checkedValue(fact).performedAt:null,workStatus:item.status as WorkCoverageViewItem['workStatus'],terms:terms?'confirmed':'not_confirmed',registration:exact?checkedValue(e).registration:'not_confirmed',eligibility:exact?checkedValue(e).eligibility:'not_confirmed',...(terms?{termLabel:checkedValue(term).label,sourceLabel:checkedValue(source)}:{}),...(audience==='customer'?{}:{performedBy:fact?.performedBy??null,qcBy:fact?.qcBy??null})};
 });
}

const checkedValue=<T>(value:T|null|undefined):T=>{if(value===null||value===undefined)throw Error("Missing checked work value.");return value};

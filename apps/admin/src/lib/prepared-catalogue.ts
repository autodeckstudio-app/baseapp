import type {Service} from '@autodeck/core';
import type {ServicePayload} from '../experience/services-draft';
import type {CatalogueDraftView,PublicCatalogueDestination} from './catalogue-drafts';
export type PreparedDraft={draftId:string;serviceId:string|null;expectedServiceUpdatedAt:string|null;expectedDraftVersion:0;publicDestination?:PublicCatalogueDestination|null;payload:ServicePayload&{active?:boolean}};
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export function checkPreparedCatalogue(raw:unknown,services:Service[],drafts:CatalogueDraftView[]):{inputs:PreparedDraft[];existing:CatalogueDraftView[]}{
 if(!raw||typeof raw!=='object'||!Array.isArray((raw as {drafts?:unknown}).drafts))throw Error('Choose a prepared catalogue JSON file with drafts.');
 const inputs=(raw as {drafts:PreparedDraft[]}).drafts;if(!inputs.length||inputs.length>80)throw Error('A prepared batch must contain 1 to 80 drafts.');
 const ids=new Set<string>(),targets=new Set<string>(),existing:CatalogueDraftView[]=[];
 for(const d of inputs){
  if(!d||typeof d.draftId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(d.draftId)||ids.has(d.draftId)||d.expectedDraftVersion!==0||!d.payload||typeof d.payload.name!=='string'||!d.payload.name.trim()||!Number.isSafeInteger(d.payload.basePrice)||d.payload.basePrice<0||!(d.serviceId===null||typeof d.serviceId==='string')||!(d.expectedServiceUpdatedAt===null||typeof d.expectedServiceUpdatedAt==='string'))throw Error('Invalid or duplicate prepared draft.');
  ids.add(d.draftId);const target=d.serviceId??'new:'+d.draftId;if(targets.has(target))throw Error('One prepared change per service is required.');targets.add(target);
  if(d.serviceId){const s=services.find(s=>s.id===d.serviceId);if(!s||s.updatedAt!==d.expectedServiceUpdatedAt)throw Error('A source service changed. Rebuild the prepared batch.');}
  const old=drafts.find(x=>x.id===d.draftId);if(old){if(old.version!==1||!['draft','reviewed'].includes(old.state)||old.serviceId!==d.serviceId||old.expectedServiceUpdatedAt!==d.expectedServiceUpdatedAt||canonical(old.payload)!==canonical(d.payload)||(old.publicDestination??null)!==(d.publicDestination??null))throw Error('An imported draft already exists with different contents or state.');existing.push(old);}
 }
 return{inputs,existing};
}

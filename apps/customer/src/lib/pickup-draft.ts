import type { PickupQuote } from './pickup-service';
export type PickupKind='pickup'|'drop'|'both';
export type PickupDraft={kind:PickupKind|null;address:string;where:{lat:number;lng:number}|null;quote:PickupQuote|null};
const empty:PickupDraft={kind:null,address:'',where:null,quote:null};
const drafts=new Map<string,PickupDraft>();
const listeners=new Set<()=>void>();
/** Tab-memory only. No account write, URL location leak, or persisted cross-user draft. */
export const readPickupDraft=(scope:string|null):PickupDraft=>scope?drafts.get(scope)??empty:empty;
export function updatePickupDraft(scope:string|null,patch:Partial<PickupDraft>){if(!scope)return;const old=readPickupDraft(scope);drafts.set(scope,{...old,...patch});listeners.forEach(f=>f());}
export function subscribePickupDraft(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
export function pickupDraftScope(owner:{uid:string;customerId:string|null;tenantId:string|null}|null,serviceId:string|undefined){return serviceId?JSON.stringify([owner?.uid??'anonymous',owner?.customerId??null,owner?.tenantId??null,serviceId]):null;}
export function currentPickupQuote(draft:PickupDraft,now=Date.now()){return draft.kind&&draft.where&&draft.quote?.kind===draft.kind&&Date.parse(draft.quote.expiresAt)>now?draft.quote:null;}

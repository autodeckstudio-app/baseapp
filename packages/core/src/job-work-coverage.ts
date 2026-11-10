import type{WorkCoverageViewItem}from'./work-coverage-view';
export type JobWorkCoverage={status:'not_recorded'|'needs_review'|'recorded';jobId:string;revision:number|null;workLock:'open'|'locked'|'unknown';handoverReady?:boolean;items:WorkCoverageViewItem[]};
const text=(v:unknown,max=300):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const optional=(v:unknown):v is string|null|undefined=>v===undefined||v===null||text(v);
const one=<T extends string>(v:unknown,values:T[]):v is T=>typeof v==='string'&&values.includes(v as T);
/** Validate at each app's transport boundary; self results never expose staff IDs. */
export function parseJobWorkCoverage(data:unknown,jobId:string,self:boolean):JobWorkCoverage{
 const fail=()=>{throw Error('Work record could not be checked.')};
 if(!data||typeof data!=='object')return fail();const v=data as Record<string,unknown>;
 if(v.jobId!==jobId||!one(v.status,['not_recorded','needs_review','recorded'])||!Array.isArray(v.items)||v.items.length>100)return fail();
 if(v.status==='recorded'?typeof v.revision!=='number'||!Number.isInteger(v.revision)||v.revision<1:v.revision!==null||v.items.length!==0)return fail();
 if(v.handoverReady!==undefined&&typeof v.handoverReady!=='boolean')return fail();
 const workLock=v.workLock??'unknown';if(!one(workLock,['open','locked','unknown'])||v.status!=='recorded'&&workLock==='locked')return fail();
 const ids=new Set<string>();const items:WorkCoverageViewItem[]=[];
 for(const item of v.items){if(!item||typeof item!=='object')return fail();const i=item as Record<string,unknown>;if(!text(i.id,120)||ids.has(i.id)||!text(i.title)||!(i.product===null||text(i.product))||!(i.coverage===null||text(i.coverage))||!(i.performedAt===null||(text(i.performedAt,80)&&!Number.isNaN(Date.parse(i.performedAt))))||!one(i.workStatus,['Not recorded','Needs QC','QC recorded','Needs review'])||!one(i.terms,['not_confirmed','confirmed'])||!one(i.registration,['not_confirmed','confirmed','not_required'])||!one(i.eligibility,['not_confirmed','eligible','needs_review'])||!optional(i.termLabel)||!optional(i.performedBy)||!optional(i.qcBy))return fail();
  if(i.terms==='confirmed'){try{if(!text(i.termLabel)||!text(i.sourceLabel,2000)||!new URL(i.sourceLabel).toString().startsWith('https:'))return fail()}catch{return fail()}}
  ids.add(i.id);items.push({id:i.id,title:i.title,product:i.product,coverage:i.coverage,performedAt:i.performedAt,workStatus:i.workStatus,terms:i.terms,registration:i.registration,eligibility:i.eligibility,...(i.terms==='confirmed'?{termLabel:i.termLabel as string,sourceLabel:i.sourceLabel as string}:{}),...(self?{}:{performedBy:i.performedBy??null,qcBy:i.qcBy??null})});
 }
 return{jobId,status:v.status as JobWorkCoverage['status'],revision:v.revision as number|null,workLock,items,...(v.handoverReady===true&&workLock==='locked'&&v.status==='recorded'?{handoverReady:true}:{})};
}

/** Explicit staff command. The caller persists operationId + exact command before sending.
 * Targeted lifecycle work (replace/remove) names the EXACT Protection document id
 * and the revision the staff member reviewed; a legacy unversioned record is the
 * explicit revision 0. Product values are explicit staff evidence, never a
 * name-based brand mapping or an inferred warranty. */
export type WorkProduct={id:string;label:string;kind:string;coverage:string};
export type WorkRecordCommand={jobId:string;operationId:string;expectedRevision:number}&({action:'record';lineId:string;approvalId:string|null;performed:true;work:{kind:'service'}|{kind:'install';product:WorkProduct}|{kind:'replace';product:WorkProduct;targetId:string;targetRevision:number}|{kind:'remove';targetId:string;targetRevision:number}}|{action:'qc';lineId:string;checked:true}|{action:'seal';confirmed:true});
export type WorkRecordReceipt={jobId:string;operationId:string;committedRevision:number;alreadyRecorded:boolean};
export function parseWorkRecordReceipt(value:unknown,command:Pick<WorkRecordCommand,'jobId'|'operationId'|'expectedRevision'>):WorkRecordReceipt{const r=value as Partial<WorkRecordReceipt>|null;if(!r||r.jobId!==command.jobId||r.operationId!==command.operationId||!Number.isSafeInteger(r.committedRevision)||r.committedRevision!==command.expectedRevision+1||typeof r.alreadyRecorded!=='boolean')throw Error('Work submission not confirmed.');return{jobId:command.jobId,operationId:command.operationId,committedRevision:checkedValue(r.committedRevision),alreadyRecorded:r.alreadyRecorded}}

const checkedValue=<T>(value:T|null|undefined):T=>{if(value===null||value===undefined)throw Error("Missing checked work value.");return value};

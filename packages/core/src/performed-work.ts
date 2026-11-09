// Review-only shared contract. No Firestore writes, warranty issuance, payment or permission grants.
// A purchased or approved item is context, not evidence of performed work.
export type WorkScope={tenantId:string;studioId:string;jobId:string;vehicleId:string;customerId:string};
export type WorkLine={id:string;serviceId:string;productId:string|null;title:string;source:'booked'|'approved_extra';approvalId:string|null;approvalStatus:'approved'|null};
export type WorkFact={lineId:string;action:'service'|'install'|'replace'|'remove';productId:string|null;productKind?:string|null;coverage:string|null;targetId:string|null;targetRevision:number|null;performedBy:string;performedAt:string;qcBy:string|null;qcAt:string|null;warranty:{kind:'none';reviewedBy:string}|{kind:'terms';id:string;version:number}|{kind:'unknown'}};
export type ApprovedTerm={id:string;version:number;productId:string;coverage:string;text:string;label:string};
export type WorkLedger={scope:WorkScope;revision:number;lines:WorkLine[];facts:WorkFact[];sealedAt:string|null};
export type LifecycleTarget={id:string;revision:number;productId:string|null;productKind?:string|null;coverage:string|null;current:boolean;scope:WorkScope};
/** The fields of a vehicle Protection record the lifecycle bridge reads. */
export type ProtectionTargetRecord={id:string;tenantId:string;vehicleId:string;customerId:string;kind:string;provider?:string|null;coverage?:string|null;lifecycle?:string|null;revision?:number|null;installedByJobId?:string|null};
/** Exact lifecycle target resolved from a vehicle's own Protection record.
 * No name-based mapping: product identity is the record's own provider, the
 * kind only the two cosmetic kinds, the coverage only the recorded scope
 * (absent = unknown, never assumed whole-car). A missing legacy revision is
 * the explicit 0; a malformed stored revision can never equal a declared
 * revision, so it fails closed. The studio identity comes from the job the
 * review runs against, because Protection records carry no studio field. */
export function protectionLifecycleTarget(p:ProtectionTargetRecord,studioId:string):LifecycleTarget{
 return{id:p.id,revision:p.revision===null||p.revision===undefined?0:typeof p.revision==='number'&&Number.isInteger(p.revision)&&p.revision>=0?p.revision:-1,productId:typeof p.provider==='string'&&p.provider.trim()?p.provider:null,productKind:p.kind==='ppf'||p.kind==='ceramic'?p.kind:null,coverage:typeof p.coverage==='string'&&p.coverage.trim()?p.coverage:null,current:(p.lifecycle??'current')==='current',scope:{tenantId:p.tenantId,studioId,jobId:typeof p.installedByJobId==='string'?p.installedByJobId:'',vehicleId:p.vehicleId,customerId:p.customerId}};
}
export type WorkIssue={lineId:string|null;code:string;message:string};
const same=(a:WorkScope,b:WorkScope)=>Object.keys(a).every(k=>a[k as keyof WorkScope]===b[k as keyof WorkScope]);
const date=(s:string|null)=>!!s&&!Number.isNaN(Date.parse(s));
export function reviewPerformedWork(ledger:WorkLedger,current:{scope:WorkScope;vehicleActive:boolean;terms:ApprovedTerm[];targets:LifecycleTarget[]}):WorkIssue[]{
 const issues:WorkIssue[]=[];const add=(lineId:string|null,code:string,message:string)=>issues.push({lineId,code,message});
 if(!same(ledger.scope,current.scope)||!current.vehicleActive)add(null,'scope_changed','Job, car or customer changed. Reload this work record.');
 if(new Set(ledger.lines.map(l=>l.id)).size!==ledger.lines.length)add(null,'duplicate_line','Work item references need review.');
 for(const f of ledger.facts)if(!ledger.lines.some(l=>l.id===f.lineId))add(f.lineId,'orphan_fact','Work evidence has no matching job item.');
 const targets=new Set<string>();
 for(const line of ledger.lines){
  const fs=ledger.facts.filter(f=>f.lineId===line.id);
  if(line.source==='approved_extra'&&(!line.approvalId||line.approvalStatus!=='approved'))add(line.id,'unapproved_extra','Additional work needs its recorded approval.');
  if(fs.length!==1){add(line.id,fs.length?'duplicate_fact':'not_recorded',fs.length?'Conflicting work records need review.':'Record the actual work once during work or QC.');continue;}
  const f=checkedValue(fs[0]);
  if(!f.performedBy.trim()||!date(f.performedAt))add(line.id,'performance_missing','Who did the work and when are missing.');
  if(!f.qcBy?.trim()||!date(f.qcAt)||Date.parse(checkedValue(f.qcAt))<Date.parse(f.performedAt))add(line.id,'qc_missing','Confirm the recorded work during QC.');
  if(f.productId!==line.productId)add(line.id,'product_changed','The recorded product does not match this work item.');
  if(f.action!=='service'&&(!f.productId||!f.coverage?.trim()))add(line.id,'scope_missing','Record the exact product and coverage.');
  if(f.action==='replace'||f.action==='remove'){
   const t=current.targets.find(candidate=>candidate.id===f.targetId);
   if(!t||!(t.scope.tenantId===ledger.scope.tenantId&&t.scope.studioId===ledger.scope.studioId&&t.scope.vehicleId===ledger.scope.vehicleId&&t.scope.customerId===ledger.scope.customerId)||!t.current||t.revision!==f.targetRevision||(f.action==='remove'&&(t.productId!==f.productId||t.coverage!==f.coverage))||(f.action==='replace'&&(!t.productKind||!f.productKind||t.productKind!==f.productKind||t.coverage!==f.coverage)))add(line.id,'target_changed','The replaced or removed record changed. Review the exact current record.');
   if(f.targetId&&targets.has(f.targetId))add(line.id,'target_reused','One old record cannot be replaced or removed twice.');
   if(f.targetId)targets.add(f.targetId);
  }else if(f.targetId!==null||f.targetRevision!==null)add(line.id,'unexpected_target','This work action must not change an old record.');
  if(f.action==='remove'){if(f.warranty.kind!=='none')add(line.id,'removal_terms','Removal does not create new warranty coverage.');}
  else if(f.warranty.kind==='unknown')add(line.id,'terms_missing','Confirm whether approved warranty terms apply.');
  else if(f.warranty.kind==='none'){if(!f.warranty.reviewedBy.trim())add(line.id,'terms_missing','Warranty applicability has not been reviewed.');}
  else {const term=f.warranty;const t=current.terms.find(candidate=>candidate.id===term.id&&candidate.version===term.version);if(!t||t.productId!==f.productId||t.coverage!==f.coverage||!t.text.trim())add(line.id,'terms_changed','Exact product terms and version need review.');}
 }
 return issues;
}
export function workProjection(ledger:WorkLedger,issues:WorkIssue[],audience:'customer'|'studio'|'admin'){
 return {jobId:ledger.scope.jobId,vehicleId:ledger.scope.vehicleId,customerId:ledger.scope.customerId,revision:ledger.revision,sealedAt:ledger.sealedAt,ready:issues.length===0,items:issues.some(i=>i.code==='scope_changed')?[]:ledger.lines.map(l=>{const f=ledger.facts.find(candidate=>candidate.lineId===l.id);return{lineId:l.id,title:l.title,productId:l.productId,action:f?.action??null,status:!f?'Not recorded':issues.some(i=>i.lineId===l.id&&!['terms_missing','terms_changed','removal_terms','qc_missing'].includes(i.code))?'Needs review':issues.some(i=>i.lineId===l.id&&i.code==='qc_missing')?(!f.qcAt&&!f.qcBy?'Needs QC':'Needs review'):f.qcAt?'QC recorded':'Needs QC',coverage:f?.coverage??null,warranty:f?.warranty.kind==='terms'?'Approved terms linked':f?.warranty.kind==='none'?'No new warranty recorded':'Terms not confirmed',...(audience==='customer'?{}:{performedBy:f?.performedBy??null,qcBy:f?.qcBy??null})}}),issues:issues.map(i=>({lineId:i.lineId,message:i.message}))};
}

const checkedValue=<T>(value:T|null|undefined):T=>{if(value===null||value===undefined)throw Error("Missing checked work value.");return value};

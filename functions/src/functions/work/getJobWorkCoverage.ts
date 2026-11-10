// Combined read-only integration candidate, not deployed.
// A booked/paid/invoiced service is never promoted into performed work here.
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{z}from'zod';import{createHash}from'node:crypto';
import{recordedWorkHandover,buildWorkCoverageView,protectionLifecycleTarget,type LifecycleTarget,type WorkLedger,type ApprovedTerm,type CoverageEvidence}from'@autodeck/core';
import{COLLECTIONS}from'@autodeck/database';
import{extractUser,extractCustomerUser,assertRole}from'../../middleware/auth.js';
import{requireCustomerDocId}from'../../lib/customer-identity.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const input=z.object({jobId:id}).strict();
const scope=z.object({tenantId:id,studioId:id,jobId:id,vehicleId:id,customerId:id}).strict();
const date=z.string().datetime({offset:true});
const warranty=z.discriminatedUnion('kind',[z.object({kind:z.literal('unknown')}).strict(),z.object({kind:z.literal('none'),reviewedBy:id}).strict(),z.object({kind:z.literal('terms'),id,version:z.number().int().positive()}).strict()]);
const ledgerSchema=z.object({scope,revision:z.number().int().positive(),sealedAt:date.nullable(),lines:z.array(z.object({id,serviceId:id,productId:id.nullable(),title:z.string().min(1).max(300),source:z.enum(['booked','approved_extra']),approvalId:id.nullable(),approvalStatus:z.literal('approved').nullable()}).strict()).min(1).max(100),facts:z.array(z.object({lineId:id,action:z.enum(['service','install','replace','remove']),productId:id.nullable(),productKind:z.string().min(1).max(80).nullable().optional(),coverage:z.string().min(1).max(300).nullable(),targetId:id.nullable(),targetRevision:z.number().int().min(0).nullable(),performedBy:id,performedAt:date,qcBy:id.nullable(),qcAt:date.nullable(),warranty}).strict()).max(100)}).strict();
const evidenceSchema=z.array(z.object({lineId:id,productId:id,coverage:z.string().min(1).max(300),termId:id.nullable(),termVersion:z.number().int().positive().nullable(),registration:z.enum(['not_confirmed','confirmed','not_required']),eligibility:z.enum(['not_confirmed','eligible','needs_review']),sourceUrl:z.string().max(2000).nullable()}).strict()).max(100);
export const workSnapshotSchema=z.object({sourceJobHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),ledger:ledgerSchema,products:z.record(z.string().min(1).max(120),z.string().min(1).max(300)).refine(v=>Object.keys(v).length<=100),evidence:evidenceSchema}).strict();
const termSchema=z.object({id,version:z.number().int().positive(),productId:id,coverage:z.string().min(1).max(300),text:z.string().min(1).max(20000),label:z.string().min(1).max(300),tenantId:id,approved:z.literal(true),sourceUrl:z.string().url().max(2000)}).strict();
// Both the linked term snapshot and coverage evidence must name the same exact
// source; a matching product name alone never supplies coverage.
async function read(request:any,self:boolean){
 const user=self?extractCustomerUser(request):extractUser(request);
 if(!self)assertRole(user,'studio','admin','superadmin');
 const parsed=input.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Check the visit reference.');
 await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore();
 const cid=self?await requireCustomerDocId(db,COLLECTIONS.customers(),user.claims.tenantId,user.uid):null;
 return db.runTransaction(async tx=>{
  if(cid){const profile=(await tx.get(db.collection(COLLECTIONS.customers()).doc(cid))).data();if(!profile||profile['id']!==cid||profile['authUid']!==user.uid||profile['tenantId']!==user.claims.tenantId||profile['deletedAt'])throw new HttpsError('not-found','Visit unavailable.');}
  const j=await tx.get(db.collection(COLLECTIONS.jobs()).doc(parsed.data.jobId));const job=j.data();
  if(!j.exists||!job||job['id']!==j.id||job['tenantId']!==user.claims.tenantId||typeof job['vehicleId']!=='string'||typeof job['customerId']!=='string'||typeof job['studioId']!=='string'||(self&&job['customerId']!==cid)||(!self&&user.claims.role==='studio'&&job['studioId']!==user.claims.studioId))throw new HttpsError('not-found','Visit unavailable.');
  const[v,w,c]=await Promise.all([tx.get(db.collection(COLLECTIONS.vehicles()).doc(job['vehicleId'])),tx.get(db.collection('jobPerformedWork').doc(j.id)),tx.get(db.collection(COLLECTIONS.customers()).doc(job['customerId']))]);const car=v.data();const customer=c.data();if(!customer||customer['id']!==c.id||customer['tenantId']!==user.claims.tenantId||customer['deletedAt'])throw new HttpsError('not-found','Visit unavailable.');
  if(!v.exists||!car||car['id']!==v.id||car['tenantId']!==user.claims.tenantId||car['deletedAt']||(self&&car['ownerId']!==cid))throw new HttpsError('not-found','Visit unavailable.');
  if(car['ownerId']!==job['customerId'])return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};
  if(!w.exists)return{status:'not_recorded' as const,jobId:j.id,revision:null,workLock:'open' as const,items:[]};
  const data=workSnapshotSchema.safeParse(w.data());if(!data.success)return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};
  const snap=data.data;if(new Set(snap.ledger.lines.map(line=>line.id)).size!==snap.ledger.lines.length||snap.ledger.facts.some(fact=>!snap.ledger.lines.some(line=>line.id===fact.lineId)))return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};const currentScope={tenantId:user.claims.tenantId,studioId:job['studioId']as string,jobId:j.id,vehicleId:job['vehicleId']as string,customerId:job['customerId']as string};
  if(Object.entries(currentScope).some(([key,value])=>snap.ledger.scope[key as keyof typeof currentScope]!==value))return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};
  // Only new hash-bound snapshots can supply an editable open/locked state.
  // Older records remain readable but cannot authorize a write revision.
  if(snap.sourceJobHash){const rawLines=Array.isArray(job['lines'])?job['lines']:[{serviceId:job['serviceId'],name:job['serviceName']??'Service'}];const frozen=createHash('sha256').update(JSON.stringify(rawLines)).digest('hex');const history=workSnapshotSchema.safeParse((await tx.get(db.collection('jobPerformedWork').doc(j.id).collection('revisions').doc(String(snap.ledger.revision)))).data());if(frozen!==snap.sourceJobHash||!history.success||JSON.stringify(history.data)!==JSON.stringify(snap))return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};const booked=snap.ledger.lines.filter(line=>line.source==='booked');if(booked.length!==rawLines.length||booked.some(line=>{const index=Number(line.id.replace(/^booked-/,''));const raw=rawLines[index];return!Number.isInteger(index)||line.id!==`booked-${index}`||!raw||line.serviceId!==raw.serviceId||line.title!==raw.name||line.approvalId!==null||line.approvalStatus!==null}))return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};}
  const bookedIds=Array.isArray(job['lines'])?job['lines'].map((l:any)=>l?.serviceId):[job['serviceId']];
  for(const line of snap.ledger.lines){
   if(line.source==='booked'){if(!bookedIds.includes(line.serviceId))return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};}
   else{if(!line.approvalId)return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};const approval=(await tx.get(db.collection(COLLECTIONS.approvals()).doc(line.approvalId))).data();
    if(!approval||approval['status']!=='approved'||approval['tenantId']!==currentScope.tenantId||approval['studioId']!==currentScope.studioId||approval['jobId']!==j.id||approval['customerId']!==currentScope.customerId||approval['vehicleId']!==currentScope.vehicleId||approval['serviceId']!==line.serviceId)return{status:'needs_review' as const,jobId:j.id,revision:null,workLock:'unknown' as const,items:[]};
   }
  }
  const termRefs=[...new Set(snap.evidence.flatMap(e=>e.termId&&e.termVersion?[`${e.termId}--v${e.termVersion}`]:[]))];
  const terms:ApprovedTerm[]=[];const evidence:CoverageEvidence[]=snap.evidence.map(e=>({...e}));
  for(const key of termRefs){const t=termSchema.safeParse((await tx.get(db.collection('workTermSnapshots').doc(key))).data());if(!t.success||t.data.tenantId!==user.claims.tenantId||`${t.data.id}--v${t.data.version}`!==key)continue;
   const term=t.data;for(const e of evidence)if(e.termId===term.id&&e.termVersion===term.version&&e.sourceUrl!==term.sourceUrl)e.sourceUrl=null;
   terms.push({id:term.id,version:term.version,productId:term.productId,coverage:term.coverage,text:term.text,label:term.label});
  }
  // Exact lifecycle targets from the car's own Protection records, read
  // fresh in the same transaction. A record whose stored identity disagrees
  // with its document id is a corrupt binding and is never offered as a
  // target. Manufacturer coverage remains a separate unfinished batch.
  const protSnap=await tx.get(db.collection(COLLECTIONS.vehicles()).doc(job['vehicleId']).collection('protections'));const targets:LifecycleTarget[]=[];for(const d of protSnap.docs){const p=d.data();if(p['id']!==undefined&&p['id']!==d.id)continue;if(typeof p['tenantId']!=='string'||typeof p['vehicleId']!=='string'||typeof p['customerId']!=='string'||typeof p['kind']!=='string')continue;const resolved=protectionLifecycleTarget({id:d.id,tenantId:p['tenantId'],vehicleId:p['vehicleId'],customerId:p['customerId'],kind:p['kind'],provider:p['provider']??null,coverage:p['coverage']??null,lifecycle:p['lifecycle']??null,revision:p['revision']??null,installedByJobId:p['installedByJobId']??null},job['studioId']as string);
   // A delivered visit keeps its exact completed lifecycle fact readable. This
   // is review-only history, never a current install target or a warranty.
   const facts=snap.ledger.facts.filter(f=>f.targetId===d.id);const fact=facts.length===1?facts[0]:null;const completed=job['status']==='DELIVERED'&&job['performedWorkRevision']===snap.ledger.revision&&!!snap.sourceJobHash&&JSON.stringify(job['protectionWork'])===JSON.stringify(recordedWorkHandover(snap.ledger as WorkLedger,currentScope));
   if(completed&&fact&&fact.targetRevision!==null&&resolved.revision===fact.targetRevision+1&&(fact.action==='remove'&&p['lifecycle']==='removed'&&p['removedByJobId']===j.id||fact.action==='replace'&&p['lifecycle']==='superseded'&&p['supersededByJobId']===j.id)){resolved.current=true;resolved.revision=fact.targetRevision;}
   targets.push(resolved);}
  const audience=self?'customer':user.claims.role==='studio'?'studio':'admin';
  const items=buildWorkCoverageView(snap.ledger as WorkLedger,{scope:currentScope,vehicleActive:true,terms,targets},evidence,snap.products,audience);
  return{status:'recorded' as const,jobId:j.id,revision:snap.ledger.revision,workLock:snap.sourceJobHash?(snap.ledger.sealedAt?'locked' as const:'open' as const):'unknown' as const,items,handoverReady:items.every(i=>i.workStatus==='QC recorded')&&!!snap.sourceJobHash&&recordedWorkHandover(snap.ledger as WorkLedger,currentScope)!==null};
 });
}
export const getMyJobWorkCoverage=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},request=>read(request,true));
export const getStaffJobWorkCoverage=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},request=>read(request,false));

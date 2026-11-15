import{assertVisitCancellationChargesSettled}from'../../lib/visit-cancellation-charge.js';
import{assertVisitMemberInvoice}from'../../lib/visit-invoice-settlement.js';
import{readVisitBilling}from'../../lib/visit-billing.js';
import {visitWorkReview} from '../../lib/visit-work-review.js';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {sharedVisitState,type SharedVisit} from '@autodeck/core';
import {extractUser,assertRole} from '../../middleware/auth.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
import {writeAuditLog} from '../../middleware/audit.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {readVisitMember} from '../../lib/shared-visit-members.js';
import {readVisitWorkReadiness} from '../../lib/visit-work-readiness.js';
import {readRecordedHandover} from '../../lib/recorded-work-handover.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const workReview=z.object({revision:z.number().int().positive(),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().nullable();
const input=z.object({visitId:id,expectedRevision:z.number().int().positive(),operationId:z.string().uuid(),confirmed:z.literal(true),members:z.array(z.object({jobId:id,expectedUpdatedAt:z.string().min(1),recordedWork:workReview}).strict()).min(1).max(20),review:z.object({priorManifestId:id,members:z.array(z.object({jobId:id,expectedUpdatedAt:z.string().min(1),recordedWork:workReview}).strict()).min(1).max(20)}).strict().optional()}).strict();
/** Reconfirmation replaces only the frozen handover check, never a job,
 * payment or prior delivered outcome. Every remaining service is rechecked. */
export const startVisitHandover=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');
 const p=input.safeParse(request.data);if(!p.success)throw new HttpsError('invalid-argument','Check shared handover.');
 const data=p.data;await enforceRateLimit(subjectFrom(user),'job.advanceStatus');
 const db=getFirestore(),key=createHash('sha256').update([user.claims.tenantId,user.uid,data.operationId].join('|')).digest('hex'),manifestId=`handover_${key}`,ref=db.collection('visitHandovers').doc(manifestId),payloadHash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
 return db.runTransaction(async tx=>{
  const [v,saved]=await Promise.all([tx.get(db.collection('carVisits').doc(data.visitId)),tx.get(ref)]);const visit=v.data() as SharedVisit|undefined;
  if(!visit||visit.id!==v.id||visit.tenantId!==user.claims.tenantId||user.claims.role==='studio'&&visit.studioId!==user.claims.studioId||visit.revision!==data.expectedRevision||!Array.isArray(visit.jobIds)||!visit.jobIds.length||visit.jobIds.length>20||new Set(visit.jobIds).size!==visit.jobIds.length)throw new HttpsError('failed-precondition','Shared visit changed. Reload.');
  if(saved.exists){if(saved.data()?.['payloadHash']!==payloadHash)throw new HttpsError('already-exists','Saved handover differs.');return{manifestId,alreadyStarted:true};}
  if(visit.activeHandoverId&&!data.review)throw new HttpsError('failed-precondition','Continue the existing shared handover.');
  if(data.review&&visit.activeHandoverId!==data.review.priorManifestId)throw new HttpsError('failed-precondition','Shared handover changed. Reload.');
  const priorRef=data.review?db.collection('visitHandovers').doc(data.review.priorManifestId):null;
  const prior=priorRef?(await tx.get(priorRef)).data():null;
  if(data.review&&(!prior||prior['id']!==priorRef!.id||prior['visitId']!==visit.id||prior['visitRevision']!==visit.revision||['complete','superseded'].includes(prior['status'])||(['tenantId','studioId','customerId','vehicleId'] as const).some(k=>prior[k]!==visit[k])||JSON.stringify(prior['jobIds'])!==JSON.stringify(visit.jobIds)))throw new HttpsError('failed-precondition','Shared handover changed. Reload.');
  const members=await Promise.all(visit.jobIds.map(j=>readVisitMember(tx,db,j))),state=sharedVisitState(visit,members.map(m=>m.member));
  if(!['ready','handover_incomplete'].includes(state)||!data.review&&state!=='ready')throw new HttpsError('failed-precondition','Every service must be ready.');
  if(data.members.length!==members.length||new Set(data.members.map(m=>m.jobId)).size!==members.length||members.some(m=>!data.members.some(r=>r.jobId===m.job.id&&r.expectedUpdatedAt===m.job.updatedAt)))throw new HttpsError('failed-precondition','Review every current service.');
  if(data.review&&(data.review.members.length!==members.length||new Set(data.review.members.map(m=>m.jobId)).size!==members.length||members.some(m=>!data.review!.members.some(r=>r.jobId===m.job.id&&r.expectedUpdatedAt===m.job.updatedAt))))throw new HttpsError('failed-precondition','Review every current service.');
  const [car,customer]=await Promise.all([tx.get(db.collection('vehicles').doc(visit.vehicleId)),tx.get(db.collection('customers').doc(visit.customerId))]);
  if(!car.exists||car.data()?.['tenantId']!==visit.tenantId||car.data()?.['ownerId']!==visit.customerId||car.data()?.['deletedAt']||!customer.exists||customer.data()?.['tenantId']!==visit.tenantId||customer.data()?.['deletedAt'])throw new HttpsError('failed-precondition','Visit ownership changed.');
  await assertVisitCancellationChargesSettled(tx,db,visit.id);
 const expected:Record<string,{updatedAt:string;recordedWorkRevision:number;recordedWorkHash:string}>={},outcomes:Record<string,{status:string;at:string;by:string}>={};
  const billing=members.some(m=>m.job.visitInvoiceId)?await readVisitBilling(tx,db,visit.id):null;
  for(const {job,member} of members){
   const outcome=prior?.['outcomes']?.[job.id];
   if(job.status==='DELIVERED'){
    if(!outcome||outcome.status!=='delivered'||outcome.at!==job.sealedAt||!prior?.['expected']?.[job.id])throw new HttpsError('failed-precondition','Delivered service needs review.');
    outcomes[job.id]=outcome;expected[job.id]=prior['expected'][job.id];continue;
   }
   if(outcome)throw new HttpsError('failed-precondition','Delivered outcome changed.');
   if(job.status==='CANCELLED')continue;
   if(job.status!=='READY_FOR_DELIVERY'||member.quotePending)throw new HttpsError('failed-precondition','Every service must be ready.');
   if(member.paymentStatus!=='paid'||member.paymentInFlight)throw new HttpsError('failed-precondition','Settle every service before handover.');
   const work=await readVisitWorkReadiness(tx,db,job);if(work&&!work.ready)throw new HttpsError('failed-precondition','Check every service before handover.');
   const w=(await tx.get(db.collection('jobPerformedWork').doc(job.id))).data(),revision=w?.['ledger']?.revision;
   const checked=visitWorkReview(w),reviewed=data.members.find(m=>m.jobId===job.id)?.recordedWork,priorReview=data.review?.members.find(m=>m.jobId===job.id)?.recordedWork;
   if(!checked||!reviewed||checked.revision!==reviewed.revision||checked.hash!==reviewed.hash||data.review&&(!priorReview||priorReview.revision!==checked.revision||priorReview.hash!==checked.hash))throw new HttpsError('failed-precondition','Recorded work changed. Review every current service.');
   if(!Number.isSafeInteger(revision)||revision<1)throw new HttpsError('failed-precondition','Lock every work record before shared handover.');
   await readRecordedHandover(tx,db,job,revision);
  await assertVisitMemberInvoice(tx,db,job,billing);
   expected[job.id]={updatedAt:job.updatedAt,recordedWorkRevision:revision,recordedWorkHash:checked.hash};
  }
  const now=new Date().toISOString();
  if(priorRef)tx.update(priorRef,{status:'superseded',supersededBy:manifestId,updatedAt:now});
  tx.update(v.ref,{activeHandoverId:manifestId});
  tx.create(ref,{id:manifestId,visitId:visit.id,visitRevision:visit.revision,tenantId:visit.tenantId,studioId:visit.studioId,customerId:visit.customerId,vehicleId:visit.vehicleId,jobIds:visit.jobIds,expected,outcomes,status:Object.keys(outcomes).length?'incomplete':'pending',payloadHash,confirmedBy:user.uid,confirmedAt:now,updatedAt:now,...(priorRef?{priorManifestId:priorRef.id}:{})});
  writeAuditLog(tx,{action:'visit.handoverStarted',entityType:'visitHandover',entityId:manifestId,user,studioId:visit.studioId,after:{visitId:visit.id,jobIds:visit.jobIds,...(priorRef?{priorManifestId:priorRef.id}:{})}});
  return{manifestId,alreadyStarted:false};
 });
});

import {z} from 'zod';import {onCall,HttpsError} from 'firebase-functions/v2/https';import {getFirestore} from 'firebase-admin/firestore';
import {visitJoinProblem,visitServiceLabel,sharedVisitState,type SharedVisit} from '@autodeck/core';import {extractUser,assertRole} from '../../middleware/auth.js';import {shouldEnforceAppCheck} from '../../lib/environment.js';import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';import {readVisitMember} from '../../lib/shared-visit-members.js';
const input=z.object({jobId:z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/)}).strict();
/** Candidate discovery does not group. Staff choose exact compatible jobs
 * after seeing service/date/state; the join transaction rechecks every one. */
export const getVisitJoinOptions=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const p=input.safeParse(request.data);if(!p.success)throw new HttpsError('invalid-argument','Check visit.');await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore();
 return db.runTransaction(async tx=>{
  const anchor=await readVisitMember(tx,db,p.data.jobId),j=anchor.job;
  if(j.tenantId!==user.claims.tenantId||user.claims.role==='studio'&&j.studioId!==user.claims.studioId)throw new HttpsError('not-found','Job unavailable.');
  if(['DELIVERED','CANCELLED'].includes(j.status))return{jobId:j.id,options:[],bounded:false};
  const existing=j.visitId?(await tx.get(db.collection('carVisits').doc(j.visitId))).data() as SharedVisit|undefined:undefined;
  if(j.visitId&&(!existing||existing.id!==j.visitId||!Array.isArray(existing.jobIds)||existing.jobIds.length>20||!existing.jobIds.includes(j.id)||existing.activeHandoverId))throw new HttpsError('failed-precondition','Review the current visit before adding a service.');
  const base=existing?await Promise.all(existing.jobIds.map(id=>readVisitMember(tx,db,id))):[anchor];
  if(existing&&(sharedVisitState(existing,base.map(m=>m.member))==='needs_review'||base.some(m=>['DELIVERED','CANCELLED'].includes(m.job.status))))throw new HttpsError('failed-precondition','Review the current visit before adding a service.');
  const project=(m:typeof anchor)=>({jobId:m.job.id,expectedUpdatedAt:m.job.updatedAt,service:m.job.lines?.map(l=>l.name).join(' + ')??'Service',status:m.job.status==='READY_FOR_DELIVERY'?'Check work':visitServiceLabel(m.job.status),scheduledDate:m.job.scheduledDate});
  const context={members:base.map(project),...(existing?{existingVisit:{visitId:existing.id,expectedRevision:existing.revision}}:{})};
  const [car,customer]=await Promise.all([tx.get(db.collection('vehicles').doc(j.vehicleId)),tx.get(db.collection('customers').doc(j.customerId))]);
  if(!car.exists||car.data()?.['ownerId']!==j.customerId||car.data()?.['tenantId']!==j.tenantId||car.data()?.['deletedAt']||!customer.exists||customer.data()?.['tenantId']!==j.tenantId||customer.data()?.['deletedAt'])throw new HttpsError('failed-precondition','Current visit ownership needs review.');
  const candidates=await tx.get(db.collection('jobs').where('tenantId','==',j.tenantId).where('vehicleId','==',j.vehicleId).where('status','in',['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY']).limit(21));
  if(candidates.size>20)return{jobId:j.id,...context,options:[],bounded:true};
  const options=[];
  for(const candidate of candidates.docs){if(base.some(m=>m.job.id===candidate.id))continue;const member=await readVisitMember(tx,db,candidate.id);if(visitJoinProblem([...base.map(m=>m.member),member.member],existing?.id))continue;options.push(project(member));}
  return{jobId:j.id,expectedUpdatedAt:j.updatedAt,...context,options,bounded:false};
 });
});

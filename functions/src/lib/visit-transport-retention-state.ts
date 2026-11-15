import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {visitReturnHash} from './visit-service-return-state.js';
const fail=():never=>{throw new HttpsError('failed-precondition','Retained original transport needs Admin review.');};
const mutable=new Set(['status','staffNote','updatedAt','pickupCompletedAt','dropCompletedAt']);
const fixed=(v:Record<string,any>)=>Object.fromEntries(Object.entries(v).filter(([k])=>!mutable.has(k)));
/** Exact original financial/request scope. Only forward physical progress can
 * differ from the cancellation snapshot. No copied request or anchor transfer. */
export async function readRetainedTransportProof(tx:Transaction,db:Firestore,record:Record<string,any>,review:Record<string,any>){
 const t=review['transport'],snapshot=t?.originalRequest,r=t?.review;
 if(!snapshot||!r||r.jobId!==record['jobId']||r.visitId!==record['visitId']||r.requestId!==record['bookingId']||
   r.needsUnusedLegDecision||r.requestToken!==visitReturnHash(snapshot)||r.retainedTransportPaise!==review['transportRetainedPaise']||
   !Array.isArray(r.retainedLegs)||!Array.isArray(r.proposedUnusedLegs)||!Array.isArray(r.completedLegs))return fail();
 const proof=(await tx.get(db.collection('visitTransportRetentions').doc(record['jobId']))).data();
 const current=(await tx.get(db.collection('pickupRequests').doc(record['bookingId']))).data();
 const visit=(await tx.get(db.collection('carVisits').doc(record['visitId']))).data();
 const closure=(await tx.get(db.collection('visitTransportClosures').doc(record['jobId']))).data();
 const booking=(await tx.get(db.collection('bookings').doc(record['bookingId']))).data();
 const signal=booking?.['transportReadRevision'];
 if(signal!==undefined||closure?.['readSignalRevision']!==undefined){
  if(!closure||!booking||!Number.isSafeInteger(closure['readSignalRevision'])||closure['readSignalRevision']<2||
   ['tenantId','studioId','customerId','vehicleId','visitId'].some(k=>booking[k]!==record[k])||
   visitReturnHash(signal)!==visitReturnHash({version:1,visitId:record['visitId'],requestId:record['bookingId'],revision:closure['readSignalRevision']}))return fail();
 }
 if(!proof||proof['id']!==record['jobId']||proof['kind']!=='visit_original_transport_retention'||
   ['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId','planId','reviewHash'].some(k=>proof[k]!==record[k])||
   proof['transportHash']!==visitReturnHash(t)||proof['retainedTransportPaise']!==review['transportRetainedPaise']||
   proof['createdBy']!==record['cancelledBy']||proof['createdAt']!==record['cancelledAt']||
   !visit||visit['transportJobId']!==record['jobId']||!current||visitReturnHash(fixed(current))!==visitReturnHash(fixed(snapshot))||
   !['REQUESTED','CONFIRMED','DONE'].includes(current['status'])||snapshot.status==='DONE'&&current['status']!=='DONE'||
   snapshot.status==='CONFIRMED'&&current['status']==='REQUESTED')return fail();
 for(const leg of ['pickup','drop']){
  const before=snapshot[leg+'CompletedAt'],at=current[leg+'CompletedAt'];
  if(before&&before!==at||at&&(!r.retainedLegs.includes(leg)||!Number.isFinite(Date.parse(at))))return fail();
 }
 if(current['status']==='DONE'&&(r.proposedUnusedLegs.length||r.retainedLegs.some((l:string)=>!current[l+'CompletedAt'])))return fail();
 if(closure||proof['closureId']!==undefined){
  if(!closure||proof['closureId']!==record['jobId']||closure['id']!==record['jobId']||closure['kind']!=='visit_explicit_unused_transport_closure'||
   closure['status']!=='closed_unused'||['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId','planId','reviewHash'].some(k=>closure[k]!==record[k])||
   closure['transportHash']!==proof['transportHash']||closure['requestHash']!==visitReturnHash(current)||closure['retainedTransportPaise']!==r.retainedTransportPaise||
   visitReturnHash(closure['unusedLegs'])!==visitReturnHash(r.proposedUnusedLegs)||visitReturnHash(closure['retainedLegs'])!==visitReturnHash(r.retainedLegs)||
   !r.proposedUnusedLegs.length||r.proposedUnusedLegs.some((l:string)=>!!current[l+'CompletedAt'])||r.retainedLegs.some((l:string)=>!current[l+'CompletedAt'])||
   typeof closure['closedBy']!=='string'||!closure['closedBy']||!Number.isFinite(Date.parse(closure['closedAt']))||
   closure['recordHash']!==visitReturnHash({...closure,recordHash:undefined}))return fail();
 }
 return{proof,current,review:r,closure:closure??null,physicalState:closure?'closed_unused' as const:current['status']==='DONE'?'completed' as const:'open' as const};
}

import{readVisitRetentionOwner}from'./visit-retained-charge.js';
import type{Firestore}from'firebase-admin/firestore';
import type{AuthorizedUser}from'@autodeck/auth';
import type{Booking}from'@autodeck/core';
import{HttpsError}from'firebase-functions/v2/https';
import{z}from'zod';
import{assertRole}from'../middleware/auth.js';
import{assertCustomerNotErasing}from'./customer-erasure-guard.js';
import{readVisitBilling}from'./visit-billing.js';
import{readRetainedTransportProof}from'./visit-transport-retention-state.js';
import{readVisitTransport,checkVisitDrop}from'./visit-transport.js';
import{visitReturnHash}from'./visit-service-return-state.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const schema=z.object({visitId:id,jobId:id,operationId:z.string().uuid(),requestToken:z.string().regex(/^[a-f0-9]{64}$/),leg:z.enum(['pickup','drop']),completed:z.literal(true)}).strict();
const fail=():never=>{throw new HttpsError('failed-precondition','Review this retained physical journey again.');};
/** DORMANT physical progress for the original request after its service was
 * cancelled. This does not revive service work, create/move a request, collect
 * money, return money, reprice or skip full-visit handover/work/payment checks.
 * The production closed-booking guard is not relaxed by this internal seam. */
export async function progressRetainedVisitTransport(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'studio','admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the exact retained journey leg.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  const visit=(await tx.get(db.collection('carVisits').doc(d.visitId))).data();
  if(!visit||visit['id']!==d.visitId||visit['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&visit['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');
  await assertCustomerNotErasing(tx,db,visit['tenantId'],visit['customerId']);
  const receiptRef=db.collection('visitTransportProgressReceipts').doc('vtp_'+visitReturnHash([user.claims.tenantId,user.uid,d.operationId])),prior=(await tx.get(receiptRef)).data();
  if(prior){if(prior['commandHash']!==visitReturnHash(d))return fail();return{...prior['result'],alreadyCompleted:true};}
  const billing=await readVisitBilling(tx,db,d.visitId),member=billing.members.find(m=>m.job.id===d.jobId);const{record,review}=await readVisitRetentionOwner(tx,db,d.jobId);
  if(!member?.booking||!record||member.job.status!=='CANCELLED')return fail();

  const retained=await readRetainedTransportProof(tx,db,record,review),r=retained.current;
  if(retained.closure||visitReturnHash(r)!==d.requestToken||r['status']!=='CONFIRMED'||!retained.review.retainedLegs.includes(d.leg)||retained.review.proposedUnusedLegs.includes(d.leg))return fail();
  const completedField=d.leg+'CompletedAt';if(r[completedField])return fail();
  const scope=await readVisitTransport(tx,db,member.booking as Booking);if(!scope)return fail();
  if(d.leg==='drop')await checkVisitDrop(tx,db,scope);
  else if(scope.members.some(m=>m.job.status!=='CANCELLED'&&m.job.status!=='PENDING_VEHICLE'))return fail();
  const now=new Date().toISOString(),next={...r,[completedField]:now};
  const done=retained.review.proposedUnusedLegs.length===0&&retained.review.retainedLegs.every((l:string)=>!!next[l+'CompletedAt']);
  const result={visitId:d.visitId,jobId:d.jobId,requestId:record['bookingId'],leg:d.leg,completedAt:now,status:done?'DONE':'CONFIRMED'};
  tx.update(db.collection('pickupRequests').doc(record['bookingId']),{[completedField]:now,status:result.status,updatedAt:now});
  tx.create(receiptRef,{kind:'visit_retained_transport_progress',tenantId:record['tenantId'],studioId:record['studioId'],commandHash:visitReturnHash(d),result,createdBy:user.uid,createdAt:now});
  return{...result,alreadyCompleted:false};
 });
}

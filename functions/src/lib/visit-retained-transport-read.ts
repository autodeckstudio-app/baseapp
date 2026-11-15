import type{Firestore}from'firebase-admin/firestore';import type{AuthorizedUser}from'@autodeck/auth';import{HttpsError}from'firebase-functions/v2/https';import{assertRole}from'../middleware/auth.js';import{readVisitBilling}from'./visit-billing.js';import{readRetainedTransportProof}from'./visit-transport-retention-state.js';
const unavailable=():never=>{throw new HttpsError('not-found','Original retained journey unavailable.');};
/** DORMANT authenticated read seam for future visit/request-list adapters. No
 * callable, direct-client rule change or UI importer. Original request status
 * remains a fact; terminal physical disposition is a separate verified state.
 * Never interprets absence of a stamp as permission to remove a future trip. */
export async function readScopedRetainedVisitTransport(db:Firestore,user:AuthorizedUser,visitId:string){
 assertRole(user,'customer','studio','admin','superadmin');if(!/^[A-Za-z0-9_-]{1,120}$/.test(visitId))return unavailable();
 return db.runTransaction(async tx=>{
  const visit=(await tx.get(db.collection('carVisits').doc(visitId))).data();
  if(!visit||visit['id']!==visitId||visit['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&visit['studioId']!==user.claims.studioId)return unavailable();
  const customer=(await tx.get(db.collection('customers').doc(visit['customerId']))).data();
  if(!customer||customer['tenantId']!==user.claims.tenantId||customer['deletedAt']||customer['erasureState']==='purging'||user.claims.role==='customer'&&customer['authUid']!==user.uid)return unavailable();
  // Full money/cancellation/issued-charge proof must succeed. A missing private
  // marker is unknown, not an empty/history result that makes a trip vanish.
  const bill=await readVisitBilling(tx,db,visitId),anchor=bill.members.find(m=>m.job.id===bill.visit.transportJobId);
  if(!anchor||anchor.job.status!=='CANCELLED')return unavailable();
  const record=(await tx.get(db.collection('visitServiceReturns').doc(anchor.job.id))).data();if(!record)return unavailable();
  const plan=(await tx.get(db.collection('visitServiceReturnPlans').doc(record['planId']))).data();if(!plan?.['review']?.['transport'])return unavailable();
  const proof=await readRetainedTransportProof(tx,db,record,plan['review']),r=proof.current,legs=proof.review.retainedLegs as('pickup'|'drop')[],unused=proof.review.proposedUnusedLegs as('pickup'|'drop')[];
  const needed=proof.physicalState==='open'?legs.filter(l=>!r[l+'CompletedAt']):[],completed=legs.filter(l=>!!r[l+'CompletedAt']);
  return{visitId,jobId:anchor.job.id,requestId:anchor.job.bookingId,originalRequestStatus:r['status'] as'REQUESTED'|'CONFIRMED'|'DONE',physicalState:proof.physicalState,
   placement:proof.physicalState==='open'?'active' as const:'history' as const,
   neededLegs:needed,completedLegs:completed,unusedLegs:[...unused],requiresExplicitUnusedClosure:proof.physicalState==='open'&&unused.length>0,
   pickupCompletedAt:typeof r['pickupCompletedAt']==='string'?r['pickupCompletedAt'] as string:null,dropCompletedAt:typeof r['dropCompletedAt']==='string'?r['dropCompletedAt'] as string:null};
 });
}

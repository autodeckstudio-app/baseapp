import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import {sharedVisitState,type Booking,type SharedVisit} from '@autodeck/core';
import {readVisitHandoverMember} from './visit-handover.js';
import {readVisitMember} from './shared-visit-members.js';
import {readVisitWorkReadiness} from './visit-work-readiness.js';
/** Resolve only explicit membership. A request on a second service cannot
 * create another physical journey or another independently charged scope. */
export async function readVisitTransport(tx:Transaction,db:Firestore,booking:Booking){
 const jobs=await tx.get(db.collection('jobs').where('bookingId','==',booking.id).limit(2));
 if(jobs.size>1)throw new HttpsError('failed-precondition','Booking jobs need review.');
 const job=jobs.docs[0]?.data(),visitId=booking.visitId??job?.['visitId'];
 if(!visitId)return null;
 if(!job||job['visitId']!==visitId||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>job[k]!==booking[k]))throw new HttpsError('failed-precondition','Visit transport scope changed.');
 const ref=db.collection('carVisits').doc(visitId),raw=(await tx.get(ref)).data();
 if(!raw||raw['id']!==visitId||!Array.isArray(raw['jobIds'])||raw['jobIds'].length<1||raw['jobIds'].length>20||!raw['jobIds'].includes(job['id'])||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>raw[k]!==booking[k]))throw new HttpsError('failed-precondition','Visit transport needs review.');
 const [car,customer]=await Promise.all([tx.get(db.collection('vehicles').doc(booking.vehicleId)),tx.get(db.collection('customers').doc(booking.customerId))]);
 if(!car.exists||car.data()?.['ownerId']!==booking.customerId||car.data()?.['tenantId']!==booking.tenantId||car.data()?.['deletedAt']||!customer.exists||customer.data()?.['tenantId']!==booking.tenantId||customer.data()?.['deletedAt'])throw new HttpsError('failed-precondition','Visit ownership changed.');
 const visit=raw as SharedVisit,members=await Promise.all(visit.jobIds.map(id=>readVisitMember(tx,db,id)));
 const state=sharedVisitState(visit,members.map(m=>m.member));
 if(state==='needs_review')throw new HttpsError('failed-precondition','Visit transport needs review.');
 if(visit.transportJobId&&visit.transportJobId!==job['id'])throw new HttpsError('failed-precondition','Use this visit\'s existing pickup and drop request.');
 if(members.some(m=>m.job.id!==job['id']&&(m.member.transportRequested||m.member.pickupFee>0||m.member.dropFee>0)))throw new HttpsError('failed-precondition','Existing visit transport needs review.');
 return{ref,visit,members,state,jobId:job['id'] as string};
}
export async function checkVisitDrop(tx:Transaction,db:Firestore,scope:NonNullable<Awaited<ReturnType<typeof readVisitTransport>>>){
 if(!['ready','delivered'].includes(scope.state))throw new HttpsError('failed-precondition','Finish every visit service before returning the car.');
 if(!scope.visit.activeHandoverId)throw new HttpsError('failed-precondition','Review shared handover before returning the car.');
 const h=(await tx.get(db.collection('visitHandovers').doc(scope.visit.activeHandoverId))).data();
 if(!h||h['visitId']!==scope.visit.id||h['visitRevision']!==scope.visit.revision||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>h[k]!==scope.visit[k])||scope.state==='delivered'&&h['status']!=='complete')throw new HttpsError('failed-precondition','Shared handover changed.');
 for(const{job,member}of scope.members){
  if(job.status==='CANCELLED')continue;
  if(member.paymentStatus!=='paid'||member.paymentInFlight||member.quotePending)throw new HttpsError('failed-precondition','Settle every visit service before returning the car.');
  if(job.status==='READY_FOR_DELIVERY')await readVisitHandoverMember(tx,db,job,scope.visit.activeHandoverId);
  else if(h['outcomes']?.[job.id]?.status!=='delivered'||h['outcomes'][job.id].at!==job.sealedAt)throw new HttpsError('failed-precondition','Delivered outcome changed.');
  const work=await readVisitWorkReadiness(tx,db,job);if(!work||!work.ready)throw new HttpsError('failed-precondition','Check every visit service before returning the car.');
 }
}

/** Evidence belongs to one physical request. Return proof cannot bypass
 * unfinished service or payment checks. Existing sealed evidence is retained. */
export async function checkVisitTransportProof(tx:Transaction,db:Firestore,booking:Booking,leg:'pickup'|'drop',requestId:string,customerId:unknown){
 const scope=await readVisitTransport(tx,db,booking);if(!scope)return;
 if(requestId!==booking.id||customerId!==booking.customerId)throw new HttpsError('failed-precondition','Visit request scope changed.');
 if(scope.visit.transportJobId!==scope.jobId)throw new HttpsError('failed-precondition',"Use this visit's existing pickup and drop request.");
 if(leg==='drop')await checkVisitDrop(tx,db,scope);
}

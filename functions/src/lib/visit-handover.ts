import{assertVisitCancellationChargesSettled}from'./visit-cancellation-charge.js';
import{assertVisitMemberInvoice}from'./visit-invoice-settlement.js';
import{readVisitBilling}from'./visit-billing.js';
import {visitWorkReview} from './visit-work-review.js';
import {readVisitMember} from './shared-visit-members.js';
import {readVisitWorkReadiness} from './visit-work-readiness.js';
import {readRecordedHandover} from './recorded-work-handover.js';
import{HttpsError}from'firebase-functions/v2/https';import type{Firestore,Transaction}from'firebase-admin/firestore';import type{ServiceJob}from'@autodeck/core';
/** Participation is read and written in the SAME transaction as delivery.
 * Never a bulk transition or a promise of cross-job atomic delivery. */
export async function readVisitHandoverMember(tx:Transaction,db:Firestore,job:ServiceJob,manifestId:string|undefined){
 if(!job.visitId){if(manifestId)throw new HttpsError('invalid-argument','No shared visit for this job.');return null;}
 if(!manifestId)throw new HttpsError('failed-precondition','Confirm the shared visit handover first.');
 const [v,m]=await Promise.all([tx.get(db.collection('carVisits').doc(job.visitId)),tx.get(db.collection('visitHandovers').doc(manifestId))]);const visit=v.data(),manifest=m.data();
 if(!visit||!manifest||visit['id']!==v.id||manifest['id']!==m.id||visit['activeHandoverId']!==m.id||manifest['visitId']!==v.id||manifest['visitRevision']!==visit['revision']||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>visit[k]!==job[k]||manifest[k]!==job[k])||!Array.isArray(visit['jobIds'])||!Array.isArray(manifest['jobIds'])||JSON.stringify(visit['jobIds'])!==JSON.stringify(manifest['jobIds'])||!visit['jobIds'].includes(job.id)||!manifest['expected']||manifest['expected'][job.id]?.updatedAt!==job.updatedAt||manifest['expected'][job.id]?.recordedWorkRevision!==undefined&&(!Number.isSafeInteger(manifest['expected'][job.id].recordedWorkRevision))||!['pending','incomplete'].includes(manifest['status'])||!manifest['outcomes']||manifest['outcomes'][job.id])throw new HttpsError('failed-precondition','Shared handover changed. Reload.');
 const [car,customer]=await Promise.all([tx.get(db.collection('vehicles').doc(job.vehicleId)),tx.get(db.collection('customers').doc(job.customerId))]);
 if(!car.exists||car.data()?.['tenantId']!==job.tenantId||car.data()?.['ownerId']!==job.customerId||car.data()?.['deletedAt']||!customer.exists||customer.data()?.['tenantId']!==job.tenantId||customer.data()?.['deletedAt'])throw new HttpsError('failed-precondition','Visit ownership changed.');
 // Recheck the whole physical visit before EACH member outcome. A later
 // approval, unpaid balance or reopened work elsewhere cannot slip through
 // merely because this member's own timestamp stayed unchanged.
 await assertVisitCancellationChargesSettled(tx,db,job.visitId);
 const billing=job.visitInvoiceId?await readVisitBilling(tx,db,job.visitId):null;
 for(const memberId of visit['jobIds']){
  const {job:member,member:projection}=await readVisitMember(tx,db,memberId);
  if(member.visitId!==v.id||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>member[k]!==job[k]))throw new HttpsError('failed-precondition','Shared handover changed. Reload.');
  const outcome=manifest['outcomes'][memberId],checked=manifest['expected'][memberId];
  if(outcome){if(member.status!=='DELIVERED'||outcome.status!=='delivered'||member.sealedAt!==outcome.at)throw new HttpsError('failed-precondition','Delivered outcome changed.');continue;}
  if(member.status==='CANCELLED'&&!checked)continue;
  if(member.status!=='READY_FOR_DELIVERY'||!checked||member.updatedAt!==checked.updatedAt||projection.paymentStatus!=='paid'||projection.paymentInFlight||projection.cancellationPending||projection.quotePending)throw new HttpsError('failed-precondition','Shared handover changed. Review every remaining service.');
  const ready=await readVisitWorkReadiness(tx,db,member);if(ready&&!ready.ready)throw new HttpsError('failed-precondition','Shared work changed. Review every remaining service.');
  const snapshot=visitWorkReview((await tx.get(db.collection('jobPerformedWork').doc(member.id))).data());
  if(!snapshot||snapshot.revision!==checked.recordedWorkRevision||snapshot.hash!==checked.recordedWorkHash)throw new HttpsError('failed-precondition','Shared work changed. Review every remaining service.');
  await readRecordedHandover(tx,db,member,checked.recordedWorkRevision);
  await assertVisitMemberInvoice(tx,db,member,billing);
 }
 return{ref:m.ref,manifest};
}

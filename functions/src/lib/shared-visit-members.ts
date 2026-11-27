import {HttpsError} from 'firebase-functions/v2/https';
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import type {ServiceJob,VisitMember} from '@autodeck/core';
import {activeReservationRefsForBooking} from './bay-reservations.js';
/** One bounded exact-document read set. No plate/date matching. */
export async function readVisitMember(tx:Transaction,db:Firestore,jobId:string){
 const snap=await tx.get(db.collection('jobs').doc(jobId)),job=snap.data() as (ServiceJob&{visitId?:string})|undefined;
 if(!job||job.id!==snap.id)throw new HttpsError('not-found','Visit member unavailable.');
 const [picks,payments,b]=await Promise.all([tx.get(db.collection('pickupRequests').where('jobId','==',jobId).limit(2)),tx.get(db.collection('payments').where('jobId','==',jobId).where('status','in',['pending','processing']).limit(1)),job.bookingId?tx.get(db.collection('bookings').doc(job.bookingId)):Promise.resolve(null)]);
 const booking=b?.data();
 if(job.bookingId&&(!booking||booking['id']!==job.bookingId||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>booking[k]!==job[k])))throw new HttpsError('failed-precondition','Booking scope changed.');
 const pickup=job.bookingId?await tx.get(db.collection('pickupRequests').doc(job.bookingId)):null;
 if(pickup?.exists){const p=pickup.data()!;if(p['tenantId']!==job.tenantId||p['bookingId']!==job.bookingId||p['customerId']!==job.customerId)throw new HttpsError('failed-precondition','Transport scope changed.');}
 const transportRequested=!!pickup?.exists&&!['CANCELLED','DECLINED'].includes(pickup.data()?.['status'])||picks.docs.some(d=>!['CANCELLED','DECLINED'].includes(d.data()['status']));
 const member:VisitMember={id:job.id,tenantId:job.tenantId,studioId:job.studioId,customerId:job.customerId,vehicleId:job.vehicleId,...(job.visitId?{visitId:job.visitId}:{}),status:job.status,updatedAt:job.updatedAt,totalAmount:job.totalAmount,paymentStatus:job.paymentStatus,scheduledDate:job.scheduledDate,pickupFee:job.priceBreakdown?.pickupFee??0,dropFee:job.priceBreakdown?.dropFee??0,transportRequested,cancellationPending:!!booking&&['waiting','needs_review'].includes(booking['cancelIntent']?.state),paymentInFlight:!payments.empty,quotePending:!!booking&&(booking['priceOnRequest']===true||booking['requiresPriceApproval']===true)&&booking['quoteStatus']!=='approved'};
 // Only an ACTIVE stage reservation blocks joining: released (historical) ones never do. Queried only for a booking that
 // was created with stage reservations, so ordinary single-bay members add no read (equality-only query, no index).
 const hasStageIds=(job.bayReservationIds?.length??0)>0||(Array.isArray(booking?.['bayReservationIds'])&&(booking!['bayReservationIds'] as unknown[]).length>0);
 if(hasStageIds&&job.bookingId&&(await activeReservationRefsForBooking(tx,db,job.bookingId)).length>0)member.stageReservations=true;
 return{job,member,ref:snap.ref,booking};
}

import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@autodeck/database';
import { z } from 'zod';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
export const visitReviewTargetSchema=z.object({bookingId:id.optional(),jobId:id.optional()}).strict().refine(v=>!!v.bookingId!==!!v.jobId,'Choose one visit reference.');
export type VisitReviewTarget={bookingId?:string|undefined;jobId?:string|undefined};
export async function resolveVisitReviewTarget(db:Firestore,tx:Transaction,input:VisitReviewTarget,tenantId:string,customerIds:string[]){
 const denied=()=>new HttpsError('not-found','Visit unavailable.');
 const owned=(v:FirebaseFirestore.DocumentData|undefined)=>!!v&&v['tenantId']===tenantId&&customerIds.includes(v['customerId']);
 let bookingId=input.bookingId??null,jobId:string|null=null;
 let job:FirebaseFirestore.DocumentData|undefined;
 if(input.jobId){const snap=await tx.get(db.collection(COLLECTIONS.jobs()).doc(input.jobId));job=snap.data();if(!owned(job)||job?.['id']!==snap.id)throw denied();
  if(job!['status']!=='DELIVERED')throw new HttpsError('failed-precondition','You can rate a visit once it is completed.');
  jobId=snap.id;bookingId=typeof job!['bookingId']==='string'&&job!['bookingId']?job!['bookingId']:null;
  if(!bookingId&&job!['isWalkIn']!==true)throw denied();
 }
 let booking:FirebaseFirestore.DocumentData|undefined;
 if(bookingId){const snap=await tx.get(db.collection(COLLECTIONS.bookings()).doc(bookingId));booking=snap.data();if(!owned(booking)||(booking!['id']!==undefined&&booking!['id']!==snap.id))throw denied();
  if(booking!['status']!=='COMPLETED')throw new HttpsError('failed-precondition','You can rate a visit once it is completed.');
  if(job&&(booking!['customerId']!==job['customerId']||booking!['vehicleId']!==job['vehicleId']||booking!['serviceId']!==job['serviceId']||booking!['studioId']!==job['studioId']))throw denied();
 }
 const source=booking??job;if(!source||typeof source['serviceId']!=='string'||!source['serviceId'])throw denied();
 return {id:bookingId??`walkin-${jobId}`,bookingId,jobId,tenantId,customerId:source['customerId'] as string,serviceId:source['serviceId'] as string,source:bookingId?'booking' as const:'walkin' as const};
}

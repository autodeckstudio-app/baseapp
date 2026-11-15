import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {HttpsError} from 'firebase-functions/v2/https';
import type {ServiceJob} from '@autodeck/core';
/** Cancel only this service, never the physical visit or another obligation.
 * A frozen handover or its charged transport owner needs explicit review. */
export async function checkVisitCancellation(tx:Transaction,db:Firestore,job:ServiceJob){
 if(!job.visitId)return;
 const visit=(await tx.get(db.collection('carVisits').doc(job.visitId))).data();
 if(!visit||visit['id']!==job.visitId||!Array.isArray(visit['jobIds'])||!visit['jobIds'].includes(job.id)||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>visit[k]!==job[k]))throw new HttpsError('failed-precondition','Visit needs review before cancellation.');
 if(visit['activeHandoverId'])throw new HttpsError('failed-precondition','Review the shared handover before cancelling a service.');
 if(visit['transportJobId']===job.id)throw new HttpsError('failed-precondition','Resolve this visit\'s pickup and drop before cancelling its transport service.');
}

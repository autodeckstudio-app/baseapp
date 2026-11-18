import type {Firestore} from 'firebase-admin/firestore';
import type {AuditLog,ServiceJob} from '@autodeck/core';
import type {NotificationDraft} from './notification-events.js';
import {readCustomerNotificationTarget} from './customer-notification-target.js';
export async function jobDelayNotification(db:Firestore,log:AuditLog):Promise<NotificationDraft|null>{
 return db.runTransaction(async tx=>{
  const job=(await tx.get(db.collection('jobs').doc(log.entityId))).data() as ServiceJob|undefined;
  if(!job||job.id!==log.entityId||job.tenantId!==log.tenantId||job.studioId!==log.studioId||job.delayReported?.auditId!==log.id||!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK'].includes(job.status))return null;
  const userId=await readCustomerNotificationTarget(tx,db,job.tenantId,job.customerId);if(!userId)return null;
  return {userId,type:'job_delayed',title:'A little more time',body:'Your service is taking longer than planned. The studio will update you when your car is ready.',entityType:job.bookingId?'Booking':null,entityId:job.bookingId??null,dedupeKey:`delay-${job.visitId?'visit-'+job.visitId:'job-'+job.id}`};
 });
}

import{readCustomerNotificationTarget}from'./customer-notification-target.js';
import type {Firestore} from 'firebase-admin/firestore';
import {sharedVisitState,type SharedVisit,type ServiceJob} from '@autodeck/core';
import {readVisitMember} from './shared-visit-members.js';
import {readVisitWorkReadiness} from './visit-work-readiness.js';
import type {NotificationDraft} from './notification-events.js';
/** Physical arrival/collection messages belong to the exact visit, not each
 * service. Read current state so delayed audit delivery cannot announce a
 * pickup after another service reopened or the car already left. */
export async function visitNotification(db:Firestore,job:ServiceJob,nextStatus:string,vehicle:string):Promise<NotificationDraft|null>{
 // Defense in depth for direct callers: non-ready stages are app-only.
 if(nextStatus!=='READY_FOR_DELIVERY')return null;
 return db.runTransaction(async tx=>{
  const raw=(await tx.get(db.collection('carVisits').doc(job.visitId!))).data();
  if(!raw||raw['id']!==job.visitId||!Array.isArray(raw['jobIds'])||!raw['jobIds'].length||raw['jobIds'].length>20||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>raw[k]!==job[k]))return null;
  const visit=raw as SharedVisit,members=await Promise.all(visit.jobIds.map(id=>readVisitMember(tx,db,id))),state=sharedVisitState(visit,members.map(m=>m.member));
  if(state==='needs_review')return null;
  const anchor=members.find(m=>m.job.id===job.id);if(!anchor||anchor.job.status!==nextStatus)return null;
  const active=members.filter(m=>m.job.status!=='CANCELLED');
  let type:NotificationDraft['type'],title:string,body:string;
  if(nextStatus==='READY_FOR_DELIVERY'){
   if(state!=='ready')return null;
   for(const m of active){const work=await readVisitWorkReadiness(tx,db,m.job);if(!work||!work.ready)return null;}
   type='job_completed';title='Ready for you';body=`${vehicle} is ready. All visit services are complete.`;
  }else return null;
  const userId=await readCustomerNotificationTarget(tx,db,job.tenantId,job.customerId);if(!userId)return null;
  const target=members.find(m=>m.job.bookingId)?.job.bookingId??null;
  return{userId,type,title,body,entityType:target?'Booking':null,entityId:target,dedupeKey:`visit-${visit.id}-${type}`};
 });
}

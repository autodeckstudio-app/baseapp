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
  }else if(nextStatus==='DELIVERED'){
   if(state!=='delivered')return null;type='vehicle_delivered';title='Thank you';body=`Enjoy your ${vehicle}. Your visit is complete.`;
  }else if(nextStatus==='VEHICLE_RECEIVED'){
   // A later explicit join does not bring an already-arrived car in again.
   if(!Number.isFinite(Date.parse(visit.createdAt))||active.some(m=>m.job.statusHistory?.some(h=>h.status==='VEHICLE_RECEIVED'&&Date.parse(h.changedAt)<Date.parse(visit.createdAt))))return null;
   if(active.some(m=>m.job.status==='PENDING_VEHICLE')||['ready','handover_incomplete','delivered'].includes(state))return null;type='vehicle_received';title='Your car is in';body=`${vehicle} is checked in for this visit.`;
  }else if(nextStatus==='IN_PROGRESS'){
   if(['ready','handover_incomplete','delivered'].includes(state))return null;type='job_started';title='Work has begun';body=`Work has started on your ${vehicle}.`;
  }else if(nextStatus==='QUALITY_CHECK'){
   if(!active.every(m=>['QUALITY_CHECK','READY_FOR_DELIVERY'].includes(m.job.status)))return null;type='quality_check';title='Final checks';body=`${vehicle} is getting its final visit checks.`;
  }else return null;
  const userId=await readCustomerNotificationTarget(tx,db,job.tenantId,job.customerId);if(!userId)return null;
  const target=members.find(m=>m.job.bookingId)?.job.bookingId??null;
  return{userId,type,title,body,entityType:target?'Booking':null,entityId:target,dedupeKey:`visit-${visit.id}-${type}`};
 });
}

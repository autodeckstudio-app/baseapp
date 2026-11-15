import {hasReleasedBay} from './constants';
import type {ServiceJob} from './types/job';
import type {SharedVisit} from './shared-visit';
/** One physical location is distinct from individual progress. Detaching an
 * unfinished service changes no work/QC facts; resumption needs admission. */
export type VisitBayMember=Pick<ServiceJob,'id'|'tenantId'|'studioId'|'customerId'|'vehicleId'|'visitId'|'bayId'|'status'|'updatedAt'|'bayReleasedAt'|'bayReleasedBy'>&{requiredBayType:string;paused:boolean};
export type VisitBayReview={expectedRevision:number;members:{jobId:string;expectedUpdatedAt:string}[];pauseJobIds:string[];vacatedBayIds?:string[];targetBayId:string;targetBayType:string;admitJobId:string|null};
export type VisitBayPlan={sourceBayId:string|null;targetBayId:string;attachJobIds:string[];pauseJobIds:string[];unchangedJobIds:string[];reconciledBayIds?:string[]};
export type VisitBayProblem='scope_changed'|'stale_review'|'location_conflict'|'invalid_target'|'service_review'|'handover_started'|'not_arrived';
const physicallyActive=(m:VisitBayMember)=>['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY'].includes(m.status);
export function planVisitBayMove(visit:SharedVisit,members:readonly VisitBayMember[],review:VisitBayReview):VisitBayPlan|VisitBayProblem{
 if(visit.activeHandoverId)return'handover_started';
 if(!Number.isSafeInteger(visit.revision)||visit.revision<1||!visit.jobIds.length||visit.jobIds.length>20||new Set(visit.jobIds).size!==visit.jobIds.length||members.length!==visit.jobIds.length||new Set(members.map(m=>m.id)).size!==members.length||members.some(m=>!visit.jobIds.includes(m.id)||m.visitId!==visit.id||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>m[k]!==visit[k])))return'scope_changed';
 if(review.expectedRevision!==visit.revision||review.members.length!==members.length||new Set(review.members.map(m=>m.jobId)).size!==members.length||members.some(m=>!review.members.some(r=>r.jobId===m.id&&r.expectedUpdatedAt===m.updatedAt)))return'stale_review';
 if(!review.targetBayId||!review.targetBayType||new Set(review.pauseJobIds).size!==review.pauseJobIds.length||review.pauseJobIds.some(id=>!members.some(m=>m.id===id)))return'invalid_target';
 if(members.some(m=>!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERED','CANCELLED'].includes(m.status)||m.paused&&(!physicallyActive(m)||m.status==='READY_FOR_DELIVERY')))return'service_review';
 const attached=members.filter(m=>physicallyActive(m)&&!m.paused&&!hasReleasedBay(m));
 if(attached.some(m=>!m.bayId)||members.some(m=>m.paused&&m.bayId))return'location_conflict';
 const source=[...new Set(attached.map(m=>m.bayId))];if(source.length>1){const expected=source.filter(id=>id!==review.targetBayId),confirmed=review.vacatedBayIds??[];if(new Set(confirmed).size!==confirmed.length||confirmed.length!==expected.length||expected.some(id=>!confirmed.includes(id)))return'location_conflict';}else if(review.vacatedBayIds?.length)return'location_conflict';
 const admit=review.admitJobId?members.find(m=>m.id===review.admitJobId):null;
 if(review.admitJobId&&(!admit||admit.status!=='STANDBY'&&!admit.paused||['DELIVERED','CANCELLED','READY_FOR_DELIVERY'].includes(admit.status)))return'not_arrived';
 if(admit&&admit.requiredBayType!==review.targetBayType)return'invalid_target';
 if(!attached.length&&!admit)return'not_arrived';
 const paused=attached.filter(m=>review.pauseJobIds.includes(m.id));
 // A completed empty bay release is its own operation. This work pause never
 // stands in for completion, QC, delivery or release of completed work.
 if(review.pauseJobIds.some(id=>!paused.some(m=>m.id===id))||paused.some(m=>m.status==='READY_FOR_DELIVERY')||admit&&review.pauseJobIds.includes(admit.id))return'service_review';
 const moving=attached.filter(m=>!review.pauseJobIds.includes(m.id));
 if(moving.some(m=>m.status!=='READY_FOR_DELIVERY'&&m.requiredBayType!==review.targetBayType))return'service_review';
 // Refuse a move with no target service: a work-pause action cannot silently
 // park the car outside this capacity-checked flow.
 const attach=[...moving.map(m=>m.id),...(admit&&!moving.some(m=>m.id===admit.id)?[admit.id]:[])];if(!attach.length)return'invalid_target';
 return{sourceBayId:source.length===1?source[0]!:null,...(source.length>1?{reconciledBayIds:source}:{}),targetBayId:review.targetBayId,attachJobIds:attach,pauseJobIds:paused.map(m=>m.id),unchangedJobIds:members.filter(m=>!attach.includes(m.id)&&!paused.some(p=>p.id===m.id)).map(m=>m.id)};
}

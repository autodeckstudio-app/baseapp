import type {JobStatus} from './types/job';
export type SharedVisit={activeHandoverId?:string;id:string;tenantId:string;studioId:string;customerId:string;vehicleId:string;jobIds:string[];transportJobId:string|null;revision:number;createdAt:string;createdBy:string;updatedAt:string;updatedBy:string};
export type VisitMember={id:string;tenantId:string;studioId:string;customerId:string;vehicleId:string;visitId?:string;status:JobStatus;updatedAt:string;totalAmount:number;paymentStatus:string;scheduledDate:string;pickupFee:number;dropFee:number;transportRequested:boolean;paymentInFlight:boolean;cancellationPending?:boolean;quotePending:boolean};
export type SharedVisitState='expected'|'working'|'ready'|'handover_incomplete'|'delivered'|'cancelled'|'needs_review';
/** Grouping is explicit only. The caller supplies exactly the member IDs
 * stored in the visit, never cars matched by plate, date or customer name. */
export function sharedVisitState(visit:SharedVisit,members:readonly VisitMember[]):SharedVisitState{
 if(!Number.isSafeInteger(visit.revision)||visit.revision<1||!visit.jobIds.length||new Set(visit.jobIds).size!==visit.jobIds.length||members.length!==visit.jobIds.length||new Set(members.map(j=>j.id)).size!==members.length||members.some(j=>!visit.jobIds.includes(j.id)||j.visitId!==visit.id||(['tenantId','studioId','customerId','vehicleId'] as const).some(k=>j[k]!==visit[k])))return 'needs_review';
 if(members.some(j=>!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERED','CANCELLED'].includes(j.status)))return 'needs_review';
 if(members.some(j=>j.cancellationPending))return 'needs_review';
 const active=members.filter(j=>j.status!=='CANCELLED');
 if(!active.length)return 'cancelled';
 if(active.every(j=>j.status==='DELIVERED'))return 'delivered';
 if(active.some(j=>j.status==='DELIVERED'))return 'handover_incomplete';
 if(active.every(j=>j.status==='READY_FOR_DELIVERY')&&!active.some(j=>j.quotePending))return 'ready';
 if(active.every(j=>j.status==='PENDING_VEHICLE'))return 'expected';
 return 'working';
}
export function visitServiceLabel(status:JobStatus):string{
 return ({PENDING_VEHICLE:'Not started',STANDBY:'Waiting for bay',VEHICLE_RECEIVED:'Car received',IN_PROGRESS:'In progress',QUALITY_CHECK:'QC',READY_FOR_DELIVERY:'Work complete',DELIVERED:'Work complete',CANCELLED:'Cancelled'} as const)[status];
}
export type VisitJoinProblem='scope_changed'|'terminal_member'|'already_joined'|'payment_in_flight'|'transport_conflict'|'invalid_amount'|'schedule_review'|'duplicate_member'|'cancellation_pending';
/** Joining never edits amounts, approvals, payment allocations or issued
 * invoices. A conflict is for staff review, never an automatic adjustment. */
export function visitJoinProblem(members:readonly VisitMember[],existingVisitId?:string):VisitJoinProblem|null{
 if(members.length<2||new Set(members.map(j=>j.id)).size!==members.length)return 'duplicate_member';
 const first=members[0]!;
 if(members.some(j=>(['tenantId','studioId','customerId','vehicleId'] as const).some(k=>j[k]!==first[k])))return 'scope_changed';
 if(members.some(j=>!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERED','CANCELLED'].includes(j.status)))return 'scope_changed';
 if(members.some(j=>['DELIVERED','CANCELLED'].includes(j.status)))return 'terminal_member';
 if(members.some(j=>j.visitId&&j.visitId!==existingVisitId))return 'already_joined';
 if(members.some(j=>j.cancellationPending))return 'cancellation_pending';
 if(members.some(j=>j.paymentInFlight))return 'payment_in_flight';
 if(members.some(j=>![j.totalAmount,j.pickupFee,j.dropFee].every(n=>Number.isSafeInteger(n)&&n>=0)))return 'invalid_amount';
 if(members.filter(j=>j.transportRequested||j.pickupFee>0||j.dropFee>0).length>1)return 'transport_conflict';
 // Different booking dates are normal for multi-day work. Only an
 // unarrived member scheduled on another day needs an explicit arrival or
 // reschedule decision; this join never edits its reservation.
 if(new Set(members.map(j=>j.scheduledDate)).size!==1&&members.some(j=>j.status==='PENDING_VEHICLE'))return 'schedule_review';
 return null;
}
/** A bill view over original obligations, NOT a new invoice/payment or a
 * guessed balance. Unaccepted quote totals stay unknown, not zero. */
export function visitBill(members:readonly VisitMember[]){
 const active=members.filter(j=>j.status!=='CANCELLED');
 const known=active.every(j=>!j.quotePending&&Number.isSafeInteger(j.totalAmount)&&j.totalAmount>=0);
 const sum=known?active.reduce((n,j)=>n+j.totalAmount,0):null;
 return {totalAmount:sum!==null&&Number.isSafeInteger(sum)?sum:null,items:members.map(j=>({jobId:j.id,totalAmount:j.quotePending?null:j.totalAmount,paymentStatus:j.paymentStatus,cancelled:j.status==='CANCELLED'}))};
}

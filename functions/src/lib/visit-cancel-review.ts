import type{readVisitBilling}from'./visit-billing.js';
export function visitCancelHold(scope:Awaited<ReturnType<typeof readVisitBilling>>,jobId:string):string|null{
 const target=scope.members.find(m=>m.job.id===jobId),line=scope.review.lines.find(l=>l.jobId===jobId);
 if(scope.visit.activeHandoverId)return'Complete the active handover review first.';
 if(!target||!line||!target.booking||['CANCELLED','EXPIRED','COMPLETED'].includes(target.booking['status'])||!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(target.job.status))return'This service work or booking needs office review.';
 if(target.booking['membershipId']||target.booking['giftId']||target.booking['membershipWashUsed'])return'Review this service benefit before cancellation.';
 if(line.appliedPaise>0||line.invoiceId)return'Original-method return review is required before cancelling a funded service.';
 if(scope.visit.transportJobId===jobId||target.member.transportRequested||target.member.pickupFee||target.member.dropFee)return'Keep or remove this visit transport through its reviewed transport decision.';
 return null;
}

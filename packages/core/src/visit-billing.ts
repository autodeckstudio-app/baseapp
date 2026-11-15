import type {SharedVisit, VisitMember} from './shared-visit';

const money=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const fail=():never=>{throw new Error('Visit billing needs a fresh review.');};
export type VisitBillLine={jobId:string;amountPaise:number;appliedPaise:number;cancelled:boolean};
export type VisitCollectionReview={visitId:string;revision:number;lines:VisitBillLine[]};

/** A new receipt applies only to the current unpaid obligations. Existing
 * receipt applications and issued invoice snapshots are never redistributed.
 * Exact integer remainders are assigned by fraction, then stable job ID. */
export function allocateVisitReceipt(review:VisitCollectionReview,receivedPaise:number){
 if(!review.visitId||!Number.isSafeInteger(review.revision)||review.revision<1||!Array.isArray(review.lines)||!review.lines.length||review.lines.length>20||!money(receivedPaise)||receivedPaise===0||new Set(review.lines.map(l=>l.jobId)).size!==review.lines.length) return fail();
 for(const line of review.lines)if(!line.jobId||!money(line.amountPaise)||!money(line.appliedPaise)||line.appliedPaise>line.amountPaise||typeof line.cancelled!=='boolean')return fail();
 const active=review.lines.filter(l=>!l.cancelled&&l.amountPaise>l.appliedPaise).map(l=>({jobId:l.jobId,due:BigInt(l.amountPaise)-BigInt(l.appliedPaise)}));
 const total=active.reduce((n,l)=>n+l.due,BigInt(0));if(total===BigInt(0)||total>BigInt(Number.MAX_SAFE_INTEGER))return fail();
 // Excess is a separate fact to review, never an extra service charge.
 const applied=BigInt(receivedPaise)<total?BigInt(receivedPaise):total;
 const entries=active.map(l=>({jobId:l.jobId,amount:applied*l.due/total,remainder:applied*l.due%total}));
 const left=applied-entries.reduce((n,l)=>n+l.amount,BigInt(0));
 const ranked=[...entries].sort((a,b)=>a.remainder===b.remainder?(a.jobId<b.jobId?-1:a.jobId>b.jobId?1:0):a.remainder>b.remainder?-1:1);
 for(let i=0;i<Number(left);i++)ranked[i]!.amount++;
 return{visitId:review.visitId,revision:review.revision,receivedPaise,appliedPaise:Number(applied),unappliedPaise:receivedPaise-Number(applied),balancePaise:Number(total-applied),entries:entries.map(l=>({jobId:l.jobId,appliedPaise:Number(l.amount)})).sort((a,b)=>a.jobId<b.jobId?-1:a.jobId>b.jobId?1:0)};
}

/** Owner ruling 15 Nov: removing a service has no cancellation fee while
 * another booked service still goes ahead. A completed/delivered service
 * counts as going ahead; a cancelled service does not. Exact membership is
 * required, so missing or contradictory records cannot manufacture a waiver.
 * This computes fee eligibility only, never authorizes cancellation/refund. */
export function visitCancellationFee(visit:SharedVisit,members:readonly VisitMember[],cancelJobId:string,existingPolicyFeePaise:number){
 if(!money(existingPolicyFeePaise)||!Number.isSafeInteger(visit.revision)||visit.revision<1||!Array.isArray(visit.jobIds)||!visit.jobIds.length||visit.jobIds.length>20||new Set(visit.jobIds).size!==visit.jobIds.length||members.length!==visit.jobIds.length||new Set(members.map(m=>m.id)).size!==members.length)return fail();
 const statuses=['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERED','CANCELLED'];
 if(members.some(m=>!visit.jobIds.includes(m.id)||m.visitId!==visit.id||!statuses.includes(m.status)||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>m[k]!==visit[k])||m.cancellationPending||m.quotePending))return fail();
 const target=members.find(m=>m.id===cancelJobId);if(!target||['CANCELLED','DELIVERED'].includes(target.status))return fail();
 const continuingJobIds=members.filter(m=>m.id!==cancelJobId&&m.status!=='CANCELLED').map(m=>m.id);
 return{feePaise:continuingJobIds.length?0:existingPolicyFeePaise,reason:continuingJobIds.length?'another_service_continues' as const:'last_service_policy' as const,continuingJobIds,visitId:visit.id,revision:visit.revision};
}

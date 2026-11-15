import { isDeepStrictEqual } from 'node:util';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { readVisitBilling } from './visit-billing.js';
import { visitReturnHash } from './visit-service-return-state.js';
const fail = (): never => { throw new HttpsError('failed-precondition','Original visit transport needs Admin review.'); };
const money = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
type Leg = 'pickup' | 'drop';
type Snapshot = { subtotal:number;membershipDiscount:number|null;pickupFee:number;dropFee:number;taxRatePercent:number;tax:number;total:number;roundOffPaise?:number };

/** Decompose, never reprice. Tax follows the original pipeline's integer order:
 * service, then pickup, then drop. Marginal tax differences sum to the original
 * tax even when rounding each leg independently would invent/lose one paise.
 * Keep the one original invoice round-off on its service component. */
export function originalTransportComponents(pb:Snapshot) {
  if(![pb.subtotal,pb.membershipDiscount??0,pb.pickupFee,pb.dropFee,pb.tax,pb.total].every(money)||
    !Number.isFinite(pb.taxRatePercent)||pb.taxRatePercent<0||pb.taxRatePercent>100||
    !Number.isSafeInteger(pb.roundOffPaise??0)||Math.abs(pb.roundOffPaise??0)>50)return fail();
  const base=pb.subtotal-pb.pickupFee-pb.dropFee-(pb.membershipDiscount??0);
  if(!money(base))return fail();
  const serviceTax=Math.round(base*pb.taxRatePercent/100),throughPickup=Math.round((base+pb.pickupFee)*pb.taxRatePercent/100);
  const fullTax=Math.round((base+pb.pickupFee+pb.dropFee)*pb.taxRatePercent/100);
  if(fullTax!==pb.tax||pb.subtotal-(pb.membershipDiscount??0)+pb.tax+(pb.roundOffPaise??0)!==pb.total)return fail();
  const components={service:{basePaise:base,taxPaise:serviceTax,roundOffPaise:pb.roundOffPaise??0,totalPaise:base+serviceTax+(pb.roundOffPaise??0)},
    pickup:{basePaise:pb.pickupFee,taxPaise:throughPickup-serviceTax,totalPaise:pb.pickupFee+throughPickup-serviceTax},
    drop:{basePaise:pb.dropFee,taxPaise:fullTax-throughPickup,totalPaise:pb.dropFee+fullTax-throughPickup}};
  if(![components.service.totalPaise,components.pickup.totalPaise,components.drop.totalPaise].every(money)||
    components.service.totalPaise+components.pickup.totalPaise+components.drop.totalPaise!==pb.total)return fail();
  return components;
}

/** DORMANT read-only Admin review seam. No production route imports it.
 * The caller names the exact proposed unused legs; absence of a completion
 * stamp alone is never a decision to remove/refund them. A completed leg cannot
 * be proposed unused. No transport owner, request, price, payment, invoice or
 * benefit is changed. Retention stays on the original obligation, not a sibling.
 * A subsequent execution must recheck this token and retain Admin refund review. */
export async function readVisitTransportReturnReview(tx:Transaction,db:Firestore,visitId:string,jobId:string,unusedLegs:readonly Leg[]=[]){
  if(!Array.isArray(unusedLegs)||unusedLegs.some(l=>!['pickup','drop'].includes(l))||new Set(unusedLegs).size!==unusedLegs.length)return fail();
  const chosen:readonly Leg[]=unusedLegs;
  const scope=await readVisitBilling(tx,db,visitId),target=scope.members.find(m=>m.job.id===jobId);
  if(!target?.booking||scope.visit.transportJobId!==jobId||scope.visit.activeHandoverId||
    !['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(target.job.status)||
    ['CANCELLED','EXPIRED','COMPLETED'].includes(target.booking['status'])||target.job.additionalWorkDelta||
    target.booking['membershipId']||target.booking['giftId']||target.booking['membershipWashUsed'])return fail();
  const requestId=target.job.bookingId!,doc=await tx.get(db.collection('pickupRequests').doc(requestId)),request=doc.data();
  const otherRequests=await tx.get(db.collection('pickupRequests').where('jobId','==',jobId).limit(3));
  if(!request||request['id']!==requestId||request['bookingId']!==requestId||
    (['tenantId','studioId','customerId']as const).some(k=>request[k]!==target.job[k])||
    request['jobId']!==undefined&&request['jobId']!==jobId||request['visitId']!==undefined&&request['visitId']!==visitId||
    otherRequests.docs.some(d=>d.id!==requestId)||!['pickup','drop','both'].includes(request['kind'])||
    !['REQUESTED','CONFIRMED','DONE'].includes(request['status'])||request['memberMembershipId']||request['memberBenefitState']||
    request['feeBilled']!==true||!money(request['feePaise']))return fail();
  const pb=target.job.priceBreakdown,components=originalTransportComponents(pb);
  if(target.booking['totalAmount']!==target.job.totalAmount||!isDeepStrictEqual(target.booking['priceBreakdown'],pb)||
    !isDeepStrictEqual(target.booking['transportSnapshot']??null,target.job.transportSnapshot??null))return fail();
  const original=target.job.transportSnapshot;
  if(original&&(original.kind!==request['kind']||original.feePaise!==request['feePaise']||
    original.pickupFeePaise!==pb.pickupFee||original.dropFeePaise!==pb.dropFee||
    original.quoteId!==request['quoteId']||!isDeepStrictEqual(original.legs,request['legs'])))return fail();
  if(request['feePaise']!==pb.pickupFee+pb.dropFee||request['kind']==='pickup'&&pb.dropFee!==0||request['kind']==='drop'&&pb.pickupFee!==0)return fail();
  // Optional exact quote legs are evidence, not an invitation to split an odd
  // combined fee into two independently rounded equal halves.
  for(const [field,amount]of [['pickupFeePaise',pb.pickupFee],['dropFeePaise',pb.dropFee]]as const)
    if(request[field]!==undefined&&request[field]!==amount)return fail();
  if(request['legs']!==undefined){
    const rows=request['legs'];
    const expected=request['kind']==='both'?['pickup','drop']:[request['kind']];
    if(!Array.isArray(rows)||rows.length!==expected.length||new Set(rows.map((r:any)=>r.leg)).size!==rows.length||
      rows.some((r:any)=>!expected.includes(r.leg)||r.feePaise!==(r.leg==='pickup'?pb.pickupFee:pb.dropFee)))return fail();
  }
  const included:Leg[]=request['kind']==='both'?['pickup','drop']:[request['kind']];
  for(const leg of ['pickup','drop']as const){const at=request[leg+'CompletedAt'];if(at!==undefined&&at!==null&&(!included.includes(leg)||typeof at!=='string'||!Number.isFinite(Date.parse(at))))return fail();}
  const completedLegs=included.filter(leg=>request['status']==='DONE'||!!request[leg+'CompletedAt']);
  if(chosen.some(leg=>!included.includes(leg)||completedLegs.includes(leg)))return fail();
  const continuingJobIds=scope.members.filter(m=>m.job.id!==jobId&&m.job.status!=='CANCELLED').map(m=>m.job.id);
  const retainedLegs=included.filter(leg=>!chosen.includes(leg));
  // A future journey with no continuing service is not silently kept or closed.
  const needsUnusedLegDecision=continuingJobIds.length===0&&retainedLegs.some(l=>!completedLegs.includes(l));
  const review={visitId,jobId,requestId,continuingJobIds,completedLegs,proposedUnusedLegs:[...chosen].sort(),retainedLegs,
    needsUnusedLegDecision,originalTotalPaise:pb.total,components,
    retainedTransportPaise:retainedLegs.reduce((n,l)=>n+components[l].totalPaise,0),
    unusedTransportReviewPaise:chosen.reduce((n,l)=>n+components[l].totalPaise,0),
    sourceToken:scope.review.reviewToken,moneyToken:scope.moneyTokens.get(jobId)!,requestToken:visitReturnHash(request)};
  return {...review,reviewToken:visitReturnHash(review)};
}

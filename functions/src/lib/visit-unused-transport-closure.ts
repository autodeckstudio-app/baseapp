import type{Firestore}from'firebase-admin/firestore';import type{AuthorizedUser}from'@autodeck/auth';import{HttpsError}from'firebase-functions/v2/https';import{z}from'zod';
import{assertRole}from'../middleware/auth.js';import{assertCustomerNotErasing}from'./customer-erasure-guard.js';import{readVisitBilling}from'./visit-billing.js';import{readRetainedTransportProof}from'./visit-transport-retention-state.js';import{visitReturnHash}from'./visit-service-return-state.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
const schema=z.object({visitId:id,jobId:id,operationId:z.string().uuid(),reviewToken:hash,requestToken:hash,unusedLegs:z.array(z.enum(['pickup','drop'])).min(1).max(2),closed:z.literal(true)}).strict();
const fail=():never=>{throw new HttpsError('failed-precondition','Review the saved unused legs and completed original journey.');};
/** DORMANT explicit Admin closure of saved unused legs. No production importer.
 * This terminal proof does not stamp an unused leg completed, change request
 * status to DONE/DECLINED, move/recreate a journey, or alter charges/returns.
 * Existing live request readers do not project this proof yet: activation must
 * include truthful terminal visibility, not treat this local seam as finished UI. */
export async function closeUnusedVisitTransport(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the exact saved unused journey legs.');const d=parsed.data;
 if(new Set(d.unusedLegs).size!==d.unusedLegs.length)return fail();
 const command={...d,unusedLegs:[...d.unusedLegs].sort()},commandHash=visitReturnHash(command);
 return db.runTransaction(async tx=>{
  const visit=(await tx.get(db.collection('carVisits').doc(d.visitId))).data();if(!visit||visit['id']!==d.visitId||visit['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
  await assertCustomerNotErasing(tx,db,visit['tenantId'],visit['customerId']);
  const bill=await readVisitBilling(tx,db,d.visitId),member=bill.members.find(m=>m.job.id===d.jobId),record=(await tx.get(db.collection('visitServiceReturns').doc(d.jobId))).data();
  if(!member?.booking||member.job.status!=='CANCELLED'||!record||bill.visit.transportJobId!==d.jobId||bill.visit.activeHandoverId)return fail();
  const plan=(await tx.get(db.collection('visitServiceReturnPlans').doc(record['planId']))).data();if(!plan)return fail();
  const transport=await readRetainedTransportProof(tx,db,record,plan['review']),r=transport.current,choice=transport.review;
  if(transport.closure){if(transport.closure['commandHash']!==commandHash||transport.closure['closedBy']!==user.uid)return fail();return{status:'closed_unused' as const,requestId:record['bookingId'],alreadyClosed:true};}
  if(bill.review.reviewToken!==d.reviewToken||visitReturnHash(r)!==d.requestToken||visitReturnHash(choice.proposedUnusedLegs)!==visitReturnHash(command.unusedLegs)||
   !['REQUESTED','CONFIRMED'].includes(r['status'])||choice.needsUnusedLegDecision||choice.retainedLegs.some((l:string)=>!r[l+'CompletedAt'])||choice.proposedUnusedLegs.some((l:string)=>!!r[l+'CompletedAt']))return fail();
  const bookingRef=db.collection('bookings').doc(record['bookingId']),booking=(await tx.get(bookingRef)).data();
  if(!booking||booking['id']!==record['bookingId']||['tenantId','studioId','customerId','vehicleId','visitId'].some(k=>booking[k]!==record[k])||booking['transportReadRevision']!==undefined)return fail();
  const now=new Date().toISOString(),revision=visit['revision']+1;if(!Number.isSafeInteger(revision))return fail();
  // Cache invalidator on an already scoped readable document, not physical or
  // financial truth. No actor, note, price, private hash or terminal state.
  const readSignal={version:1,visitId:d.visitId,requestId:record['bookingId'],revision};
  const closure={id:d.jobId,kind:'visit_explicit_unused_transport_closure',status:'closed_unused',tenantId:record['tenantId'],studioId:record['studioId'],customerId:record['customerId'],vehicleId:record['vehicleId'],visitId:d.visitId,jobId:d.jobId,bookingId:record['bookingId'],planId:record['planId'],reviewHash:record['reviewHash'],transportHash:transport.proof['transportHash'],requestHash:d.requestToken,unusedLegs:command.unusedLegs,retainedLegs:choice.retainedLegs,retainedTransportPaise:choice.retainedTransportPaise,commandHash,closedBy:user.uid,closedAt:now,readSignalRevision:revision};
  tx.create(db.collection('visitTransportClosures').doc(d.jobId),{...closure,recordHash:visitReturnHash(closure)});
  tx.update(bookingRef,{transportReadRevision:readSignal});
  tx.update(db.collection('visitTransportRetentions').doc(d.jobId),{closureId:d.jobId});
  tx.update(db.collection('carVisits').doc(d.visitId),{revision,updatedBy:user.uid,updatedAt:now});
  return{status:'closed_unused' as const,requestId:record['bookingId'],alreadyClosed:false};
 });
}

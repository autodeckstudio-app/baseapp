import type {Firestore,Transaction} from 'firebase-admin/firestore';
import type {AuthorizedUser} from '@autodeck/auth';
import {HttpsError} from 'firebase-functions/v2/https';
import {z} from 'zod';
import {writeAuditLog} from '../middleware/audit.js';
import {assertRole} from '../middleware/auth.js';
import {assertCustomerNotErasing} from './customer-erasure-guard.js';
import {readVisitBilling} from './visit-billing.js';
import {readVisitOnlineProof} from './visit-online-proof.js';
import {visitReturnHash} from './visit-service-return-state.js';
import {visitOnlineReturnId,visitOnlineReturnCaptureId,readVisitOnlineReturnClaim,exactVisitRefundEvidence,type VisitOnlineReturn} from './visit-online-return-state.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const schema=z.object({visitId:id,jobId:id,entryKey:z.string().min(1).max(180),progressToken:z.string().regex(/^[a-f0-9]{64}$/),reserved:z.literal(true)}).strict();
const fail=(m='Review the original online service return before reserving.'):never=>{throw new HttpsError('failed-precondition',m);};
async function current(tx:Transaction,db:Firestore,user:AuthorizedUser,visitId:string,jobId:string){
 const v=(await tx.get(db.collection('carVisits').doc(visitId))).data();
 if(!v||v['id']!==visitId||v['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Visit unavailable.');
 await assertCustomerNotErasing(tx,db,v['tenantId'],v['customerId']);
 const scope=await readVisitBilling(tx,db,visitId),progress=scope.returnReviews.find(r=>r.jobId===jobId);
 if(!progress)return fail();return{scope,progress};
}
/** DORMANT reservation, not a provider call. Claims the exact approved online
 * source application and a global capture balance inside the same transaction.
 * One service never acquires the sibling's source share or a fake bookingId. */
export async function reserveVisitOnlineReturn(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the exact online return reservation.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  const{scope,progress}=await current(tx,db,user,d.visitId,d.jobId),e=progress.entries.find(e=>e.key===d.entryKey);
  if(!e||e.method!=='razorpay_payment_link'||e.returnPaise<=0||progress.status==='awaiting_admin')return fail();
  const requestId=visitOnlineReturnId(d.jobId,e.key),ref=db.collection('visitServiceOnlineReturns').doc(requestId),prior=(await tx.get(ref)).data()as VisitOnlineReturn|undefined;
  if(prior)return{request:await readVisitOnlineReturnClaim(tx,db,prior),alreadyReserved:true};
  if(progress.progressToken!==d.progressToken||e.returnedPaise!==0||!e.providerPaymentId)return fail();
  const record=(await tx.get(db.collection('visitServiceReturns').doc(d.jobId))).data()!,approval=(await tx.get(db.collection('visitServiceReturnApprovals').doc(d.jobId))).data();if(!approval)return fail();
  let captureAmountPaise:number;
  const aliases=await tx.get(db.collection('payments').where('razorpayPaymentId','==',e.providerPaymentId).limit(3));
  if(e.paymentId){
   const payment=(await tx.get(db.collection('payments').doc(e.paymentId))).data();
   if(!payment||payment['razorpayPaymentId']!==e.providerPaymentId||payment['amount']!==e.capturedPaise||aliases.size!==1||aliases.docs[0]!.id!==e.paymentId)return fail();
   captureAmountPaise=payment['amount'];
  }else{
   if(!e.originalReceiptId||!aliases.empty)return fail();const proof=await readVisitOnlineProof(tx,db,e.originalReceiptId);
   if(proof.receipt['providerPaymentId']!==e.providerPaymentId||!proof.applications.some(a=>a['jobId']===d.jobId&&a['appliedPaise']===e.capturedPaise))return fail();
   captureAmountPaise=proof.receipt['receivedPaise'];
  }
  const captureRef=db.collection('visitServiceOnlineReturnCaptures').doc(visitOnlineReturnCaptureId(e.providerPaymentId)),guard=(await tx.get(captureRef)).data();
  if(guard&&(guard['providerPaymentId']!==e.providerPaymentId||guard['tenantId']!==record['tenantId']||guard['studioId']!==record['studioId']||guard['customerId']!==record['customerId']||guard['captureAmountPaise']!==captureAmountPaise||guard['currency']!=='INR'||!Array.isArray(guard['claims'])))return fail();
  const claims=guard?.['claims']??[];
  if(claims.length>=121||new Set(claims.map((c:any)=>c.id)).size!==claims.length||claims.some((c:any)=>c.id===requestId||!Number.isSafeInteger(c.amountPaise)||c.amountPaise<=0)||claims.reduce((n:number,c:any)=>n+c.amountPaise,0)+e.returnPaise>captureAmountPaise)return fail();
  const now=new Date().toISOString(),request:VisitOnlineReturn={id:requestId,kind:'visit_original_online_return',tenantId:record['tenantId'],studioId:record['studioId'],customerId:record['customerId'],vehicleId:record['vehicleId'],visitId:d.visitId,jobId:d.jobId,bookingId:record['bookingId'],returnId:d.jobId,entryKey:e.key,reviewHash:record['reviewHash'],approvalHash:approval['approvalHash'],providerPaymentId:e.providerPaymentId,originalReceiptId:e.originalReceiptId,paymentId:e.paymentId,amountPaise:e.returnPaise,captureAmountPaise,currency:'INR',state:'reserved',candidateId:null,evidence:null,createdAt:now,createdBy:user.uid,updatedAt:now};
  tx.create(ref,request);tx.set(captureRef,{providerPaymentId:e.providerPaymentId,tenantId:record['tenantId'],studioId:record['studioId'],customerId:record['customerId'],captureAmountPaise,currency:'INR',claims:[...claims,{id:requestId,returnId:d.jobId,entryKey:e.key,amountPaise:e.returnPaise,reviewHash:record['reviewHash']}],updatedAt:now});
  if(!Number.isSafeInteger(scope.visit.revision+1))return fail();
  tx.update(db.collection('carVisits').doc(d.visitId),{revision:scope.visit.revision+1,updatedAt:now,updatedBy:user.uid});
  writeAuditLog(tx,{action:'payment.refund_requested',entityType:'carVisit',entityId:d.visitId,user,studioId:request.studioId,after:{jobId:d.jobId,requestId,amountPaise:request.amountPaise,providerSubmitted:false}});
  return{request,alreadyReserved:false};
 });
}

/** Injected qualification port only. A production implementation must supply
 * actual independently fetched provider entity fields and reference identity.
 * Empty/partial discovery, pending/failed status and unknown outcomes hold the
 * reservation forever until reconciliation, never release/re-submit it. */
export type VisitRefundPort={create(input:{providerPaymentId:string;amountPaise:number;currency:'INR';referenceId:string}):Promise<{id:string}>;fetch(id:string):Promise<unknown>;discover(referenceId:string,providerPaymentId:string):Promise<{complete:boolean;refunds:unknown[]}>};
async function load(tx:Transaction,db:Firestore,user:AuthorizedUser,visitId:string,jobId:string,requestId:string){
 const context=await current(tx,db,user,visitId,jobId),r=(await tx.get(db.collection('visitServiceOnlineReturns').doc(requestId))).data()as VisitOnlineReturn|undefined;
 if(!r||r.visitId!==visitId||r.jobId!==jobId||r.tenantId!==user.claims.tenantId)return fail();return{...context,r};
}
async function hold(db:Firestore,user:AuthorizedUser,visitId:string,jobId:string,requestId:string){
 return db.runTransaction(async tx=>{const{r}=await load(tx,db,user,visitId,jobId,requestId);if(r.state!=='returned'&&r.state!=='reserved')tx.update(db.collection('visitServiceOnlineReturns').doc(requestId),{state:'review_required',updatedAt:new Date().toISOString()});});
}
async function candidate(db:Firestore,user:AuthorizedUser,visitId:string,jobId:string,requestId:string,id:string){
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(id))return fail();
 return db.runTransaction(async tx=>{const{r}=await load(tx,db,user,visitId,jobId,requestId);if(r.state==='reserved'||r.candidateId&&r.candidateId!==id)return fail();if(r.state!=='returned')tx.update(db.collection('visitServiceOnlineReturns').doc(requestId),{candidateId:id,updatedAt:new Date().toISOString()});return{...r,candidateId:id};});
}
async function complete(db:Firestore,user:AuthorizedUser,visitId:string,jobId:string,requestId:string,raw:unknown){
 return db.runTransaction(async tx=>{
  const{scope,progress,r}=await load(tx,db,user,visitId,jobId,requestId),e=exactVisitRefundEvidence(r,raw);
  if(r.state==='returned')return{outcome:'returned' as const};
  if(r.state==='reserved'||!r.candidateId||e.status!=='processed')return fail();
  const identityRef=db.collection('visitServiceProviderRefunds').doc('vpr_'+visitReturnHash(e.id)),identity=(await tx.get(identityRef)).data();
  if(identity)return fail('Provider refund identity already belongs to a return.');
  const now=new Date().toISOString(),returnedPaise=progress.returnedPaise+r.amountPaise;if(returnedPaise>progress.returnPaise||!Number.isSafeInteger(scope.visit.revision+1))return fail();
  tx.create(identityRef,{requestId:r.id,providerPaymentId:r.providerPaymentId,amountPaise:r.amountPaise,tenantId:r.tenantId,recognisedAt:now});
  tx.update(db.collection('visitServiceOnlineReturns').doc(r.id),{state:'returned',evidence:e,updatedAt:now});
  tx.update(db.collection('bookings').doc(r.bookingId),{refundedPaise:returnedPaise,refundStatus:returnedPaise===progress.returnPaise?'processed':'partially_returned',returnAccountingReviewNeeded:true,updatedAt:now});
  tx.update(db.collection('carVisits').doc(visitId),{revision:scope.visit.revision+1,updatedAt:now,updatedBy:user.uid});
  writeAuditLog(tx,{action:'payment.refunded',entityType:'carVisit',entityId:visitId,user,studioId:r.studioId,after:{jobId,requestId:r.id,amountPaise:r.amountPaise,providerRefundId:e.id,accountingReviewNeeded:true}});
  return{outcome:'returned' as const};
 });
}
/** Committed first submit, then exactly one external create. Candidate response
 * alone cannot return money; exact independent fetched evidence is required. */
export async function qualifyVisitOnlineReturn(db:Firestore,user:AuthorizedUser,visitId:string,jobId:string,requestId:string,port:VisitRefundPort){
 assertRole(user,'admin','superadmin');
 const next=await db.runTransaction(async tx=>{const{r}=await load(tx,db,user,visitId,jobId,requestId);if(r.state==='reserved'){tx.update(db.collection('visitServiceOnlineReturns').doc(r.id),{state:'submitting',updatedAt:new Date().toISOString()});return{r:{...r,state:'submitting' as const},submit:true};}return{r,submit:false};});
 if(next.r.state==='returned')return{outcome:'returned' as const};
 let r=next.r;
 try{
  if(next.submit){const created=await port.create({providerPaymentId:r.providerPaymentId,amountPaise:r.amountPaise,currency:'INR',referenceId:r.id});r=await candidate(db,user,visitId,jobId,requestId,created.id);}
  if(!r.candidateId)return{outcome:'review_required' as const};
  return await complete(db,user,visitId,jobId,requestId,await port.fetch(r.candidateId));
 }catch{await hold(db,user,visitId,jobId,requestId);return{outcome:'review_required' as const};}
}
export async function reconcileVisitOnlineReturn(db:Firestore,user:AuthorizedUser,visitId:string,jobId:string,requestId:string,port:VisitRefundPort){
 assertRole(user,'admin','superadmin');const{r}=await db.runTransaction(tx=>load(tx,db,user,visitId,jobId,requestId));
 if(r.state==='returned')return{outcome:'returned' as const};if(r.state==='reserved')return{outcome:'review_required' as const};
 try{
  let fresh=r;
  if(!fresh.candidateId){const found=await port.discover(r.id,r.providerPaymentId);if(found.complete!==true||found.refunds.length!==1)return{outcome:'review_required' as const};const e=exactVisitRefundEvidence(r,found.refunds[0]);fresh=await candidate(db,user,visitId,jobId,requestId,e.id);}
  return await complete(db,user,visitId,jobId,requestId,await port.fetch(fresh.candidateId!));
 }catch{await hold(db,user,visitId,jobId,requestId);return{outcome:'review_required' as const};}
}

import{assertConnectedVisitRuntime}from'../../lib/connected-visit-release.js';
import{createHash}from'node:crypto';
import{z}from'zod';
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{allocateVisitReceipt}from'@autodeck/core';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{writeAuditLog}from'../../middleware/audit.js';
import{assertCustomerNotErasing}from'../../lib/customer-erasure-guard.js';
import{prepareVisitInvoice}from'../../lib/visit-invoice.js';
import{readVisitBilling}from'../../lib/visit-billing.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),schema=z.object({visitId:id,billId:id,reviewToken:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),receivedPaise:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),method:z.enum(['cash','upi_manual','bank_transfer']),reference:z.string().trim().max(200).default(''),confirmActualReceipt:z.literal(true)}).strict();
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** One actual receipt with exact per-service application journals. A final
 * receipt issues one new invoice for only previously unissued obligations.
 * No per-job payment is invented and no provider is called. */
export const recordVisitReceipt=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const parsed=schema.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Review the actual visit receipt.');const d=parsed.data;
 if(d.method!=='cash'&&user.claims.role==='studio')throw new HttpsError('permission-denied','Only the office can verify account receipts.');
 await enforceRateLimit(subjectFrom(user),'payment.recordManual');const db=getFirestore(),key='vr_'+hash([user.claims.tenantId,user.uid,d.operationId]),payloadHash=hash(d);
 return db.runTransaction(async tx=>{
  const visitRef=db.collection('carVisits').doc(d.visitId),v=(await tx.get(visitRef)).data();if(!v||v['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&v['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');
  // Receipt success and terminal stale rejection share an operation key. Reading
  // both documents makes concurrent/late retries serialize at one money outcome.
  const receiptRef=db.collection('visitReceipts').doc(key),attemptRef=db.collection('visitReceiptAttempts').doc(key);
  const[receiptSnap,attemptSnap]=await Promise.all([tx.get(receiptRef),tx.get(attemptRef)]),prior=receiptSnap.data(),attempt=attemptSnap.data();
  if(prior&&attempt)throw new HttpsError('failed-precondition','Receipt operation needs office review.');
  if(prior){if(prior['payloadHash']!==payloadHash)throw new HttpsError('already-exists','This receipt operation belongs to a different receipt.');return{...prior['result'],alreadyRecorded:true};}
  if(attempt){if(attempt['payloadHash']!==payloadHash||attempt['kind']!=='visit_receipt_rejected'||attempt['reason']!=='bill_changed')throw new HttpsError('already-exists','This receipt operation belongs to a different receipt.');return{rejected:true,reason:'bill_changed',command:d};}
  const current=await readVisitBilling(tx,db,d.visitId);if(current.review.reviewToken!==d.reviewToken||current.visit.activeHandoverId){
   tx.create(attemptRef,{id:key,kind:'visit_receipt_rejected',reason:'bill_changed',tenantId:user.claims.tenantId,studioId:current.visit.studioId,visitId:d.visitId,recordedBy:user.uid,payloadHash,createdAt:new Date().toISOString()});
   return{rejected:true,reason:'bill_changed',command:d};
  }
  await assertCustomerNotErasing(tx,db,current.visit.tenantId,current.visit.customerId);
  const[billSnap,headSnap]=await Promise.all([tx.get(db.collection('visitBills').doc(d.billId)),tx.get(db.collection('visitBillHeads').doc(d.visitId))]);const bill=billSnap.data(),head=headSnap.data();
  if(!bill||bill['id']!==d.billId||bill['kind']!=='visit_collection_bill'||bill['status']!=='prepared'||bill['visitId']!==d.visitId||bill['tenantId']!==current.visit.tenantId||bill['customerId']!==current.visit.customerId||bill['studioId']!==current.visit.studioId||bill['sourceToken']!==d.reviewToken||bill['totalPaise']!==current.review.totalPaise||bill['previouslyAppliedPaise']!==current.review.appliedPaise||bill['payablePaise']!==current.review.balancePaise||hash(bill['lines'])!==hash(current.review.lines)||head?.['billId']!==d.billId||head['revision']!==bill['revision'])throw new HttpsError('failed-precondition','Prepare the current itemized bill before recording money.');
  const allocation=allocateVisitReceipt(current.review,d.receivedPaise);
  if(allocation.unappliedPaise>0)throw new HttpsError('failed-precondition','Excess money needs office return review. No receipt recorded.');
  const final=allocation.balancePaise===0,entries=allocation.entries.filter(e=>e.appliedPaise>0);
  const prearrival=entries.some(e=>['PENDING_VEHICLE','STANDBY'].includes(current.members.find(m=>m.job.id===e.jobId)!.job.status));
  if(prearrival)assertConnectedVisitRuntime();
  for(const e of entries){const m=current.members.find(mEntry44=>mEntry44.job.id===e.jobId)!,line=current.review.lines.find(l=>l.jobId===e.jobId)!;
   if(!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY'].includes(m.job.status)||!final&&line.appliedPaise+e.appliedPaise>=line.amountPaise||m.job.settlementKind&&!current.coveredExtras.has(m.job.id)||m.booking?.['membershipId']&&!current.membershipExtras.has(m.job.id)&&!current.coveredExtras.has(m.job.id)||m.booking?.['giftId'])throw new HttpsError('failed-precondition','This service needs final invoice or benefit review. No receipt recorded.');
   if(current.membershipExtras.has(m.job.id)||current.coveredExtras.has(m.job.id))assertConnectedVisitRuntime();
   if((m.job.offlineSettlement?.receiptCount??0)>=100)throw new HttpsError('failed-precondition','Receipt history needs office review.');
  }
  const applicationRefs=entries.map(e=>db.collection('offlineReceipts').doc(key+'_'+hash(e.jobId).slice(0,24)));for(const ref of applicationRefs)if((await tx.get(ref)).exists)throw new HttpsError('failed-precondition','Receipt application exists without its original receipt.');
  for(const e of entries){const m=current.members.find(mEntry50=>mEntry50.job.id===e.jobId)!;if(['PENDING_VEHICLE','STANDBY'].includes(m.job.status)&&(!m.booking||m.booking['status']!=='CONFIRMED'))throw new HttpsError('failed-precondition','Review the confirmed booking before advance collection.');}
  const prepared=final?await prepareVisitInvoice(tx,db,current,key):null;
  const now=new Date().toISOString(),result={receiptId:key,billId:d.billId,invoiceId:prepared?.invoice.id??null,receivedPaise:d.receivedPaise,appliedPaise:allocation.appliedPaise,balancePaise:allocation.balancePaise,entries};
  tx.create(receiptRef,{id:key,kind:'visit_actual_receipt',tenantId:current.visit.tenantId,studioId:current.visit.studioId,customerId:current.visit.customerId,vehicleId:current.visit.vehicleId,visitId:d.visitId,billId:d.billId,sourceToken:d.reviewToken,payloadHash,method:d.method,reference:d.reference,currency:'INR',receivedPaise:d.receivedPaise,applications:entries.map((e,i)=>({...e,applicationId:applicationRefs[i]!.id})),result,createdAt:now,recordedBy:user.uid});
  entries.forEach((e,i)=>{const m=current.members.find(mEntry54=>mEntry54.job.id===e.jobId)!,line=current.review.lines.find(l=>l.jobId===e.jobId)!,old=m.job.offlineSettlement;
   tx.create(applicationRefs[i]!,{id:applicationRefs[i]!.id,visitReceiptId:key,visitId:d.visitId,billId:d.billId,tenantId:current.visit.tenantId,studioId:current.visit.studioId,customerId:current.visit.customerId,jobId:e.jobId,bookingId:m.job.bookingId,receivedPaise:e.appliedPaise,appliedPaise:e.appliedPaise,officeReturnDuePaise:0,balanceDuePaise:line.amountPaise-line.appliedPaise-e.appliedPaise,method:d.method,reference:d.reference,recordedBy:user.uid,createdAt:now});
   tx.update(m.ref,{offlineSettlement:{appliedPaise:(old?.appliedPaise??0)+e.appliedPaise,officeReturnDuePaise:0,receiptCount:(old?.receiptCount??0)+1},paymentStatus:final?'paid':'partial',...(prepared?{visitInvoiceId:prepared.invoice.id}:{}),updatedAt:now});
   if(m.job.bookingId&&current.coveredExtras.has(m.job.id))tx.update(db.collection('bookings').doc(m.job.bookingId),{visitExtrasReceiptId:key,updatedAt:now});
   if(m.job.bookingId&&!current.coveredExtras.has(m.job.id))tx.update(db.collection('bookings').doc(m.job.bookingId),{paymentStatus:final?'paid':'partial',...(prepared?{visitInvoiceId:prepared.invoice.id}:{}),updatedAt:now});
  });
  // Shared write serializes different member allocations as one receipt fact.
  tx.update(visitRef,{updatedAt:now,updatedBy:user.uid});
  if(prepared)tx.create(prepared.invoiceRef,{...prepared.invoice,createdBy:user.uid});
  writeAuditLog(tx,{action:'visit.receiptRecorded',entityType:'visitReceipt',entityId:key,user,studioId:current.visit.studioId,after:{visitId:d.visitId,billId:d.billId,receivedPaise:d.receivedPaise,entries}});
  return{...result,alreadyRecorded:false};
 });
});

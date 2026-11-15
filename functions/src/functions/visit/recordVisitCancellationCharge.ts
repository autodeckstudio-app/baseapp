import{createHash}from'node:crypto';
import{z}from'zod';
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{writeAuditLog}from'../../middleware/audit.js';
import{assertCustomerNotErasing}from'../../lib/customer-erasure-guard.js';
import{assertConnectedVisitRuntime}from'../../lib/connected-visit-release.js';
import{readVisitBilling}from'../../lib/visit-billing.js';
import{prepareCancellationChargeInvoice}from'../../lib/visit-cancellation-charge.js';
import{visitReturnHash}from'../../lib/visit-service-return-state.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),schema=z.object({visitId:id,jobId:id,reviewToken:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),receivedPaise:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),method:z.enum(['cash','upi_manual','bank_transfer']),reference:z.string().trim().max(200),confirmActualReceipt:z.literal(true)}).strict();
/** Actual separate charge receipt. Neither cancelled-service payment state nor
 * surviving-service funding is changed. A stale counted-money decision is
 * retired durably so it cannot become executable again after a later review. */
export const recordVisitCancellationCharge=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');assertConnectedVisitRuntime();const p=schema.safeParse(request.data);if(!p.success)throw new HttpsError('invalid-argument','Review the actual cancellation charge receipt.');const d=p.data;
 if(user.claims.role==='studio'&&d.method!=='cash')throw new HttpsError('permission-denied','Only the office can verify account receipts.');await enforceRateLimit(subjectFrom(user),'payment.recordManual');const db=getFirestore(),key='vcr_'+createHash('sha256').update(JSON.stringify([user.claims.tenantId,user.uid,d.operationId])).digest('hex'),payloadHash=visitReturnHash(d);
 return db.runTransaction(async tx=>{
  const visitRef=db.collection('carVisits').doc(d.visitId),v=(await tx.get(visitRef)).data();if(!v||v['id']!==d.visitId||v['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&v['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');
  const receiptRef=db.collection('visitCancellationChargeReceipts').doc(key),attemptRef=db.collection('visitCancellationChargeAttempts').doc(key),[receipt,attempt]=await Promise.all([tx.get(receiptRef),tx.get(attemptRef)]);
  if(receipt.exists&&attempt.exists)throw new HttpsError('failed-precondition','Charge receipt operation needs review.');
  if(receipt.exists){const prior=receipt.data()!;if(prior['payloadHash']!==payloadHash)throw new HttpsError('already-exists','Receipt operation belongs to another decision.');return{receiptId:key,receivedPaise:prior['receivedPaise'],alreadyRecorded:true};}
  if(attempt.exists){if(attempt.data()!['payloadHash']!==payloadHash)throw new HttpsError('already-exists','Receipt operation belongs to another decision.');return{rejected:true,reason:'charge_changed'};}
  const bill=await readVisitBilling(tx,db,d.visitId),charge=bill.chargeReviews.find(c=>c.summary.jobId===d.jobId);if(!charge)throw new HttpsError('not-found','Cancellation charge unavailable.');
  if(charge.reviewToken!==d.reviewToken||bill.visit.activeHandoverId){tx.create(attemptRef,{id:key,kind:'visit_cancellation_charge_rejected',payloadHash,reason:'charge_changed',tenantId:v['tenantId'],visitId:d.visitId,jobId:d.jobId,createdAt:new Date().toISOString(),createdBy:user.uid});return{rejected:true,reason:'charge_changed'};}
  if(d.receivedPaise>charge.summary.balancePaise||charge.receipts.length>=100)throw new HttpsError('failed-precondition','Excess money or charge receipt history needs review. No receipt recorded.');
  await assertCustomerNotErasing(tx,db,v['tenantId'],v['customerId']);
  const balancePaise=charge.summary.balancePaise-d.receivedPaise,invoice=balancePaise===0?await prepareCancellationChargeInvoice(tx,db,charge,key):null,now=new Date().toISOString();
  const row={id:key,kind:'visit_cancellation_charge_actual_receipt',...Object.fromEntries(['tenantId','studioId','customerId','vehicleId','visitId','jobId','bookingId'].map(k=>[k,charge.record[k]])),chargeId:charge.record['id'],chargeHash:charge.record['recordHash'],currency:'INR',receivedPaise:d.receivedPaise,method:d.method,reference:d.reference,payloadHash,createdAt:now,recordedBy:user.uid};
  tx.create(receiptRef,{...row,recordHash:visitReturnHash(row)});if(invoice)tx.create(db.collection('visitCancellationChargeInvoices').doc(d.jobId),invoice);
  tx.update(db.collection('bookings').doc(charge.record['bookingId']),{cancellationFeeStatus:balancePaise===0?'collected':'due',updatedAt:now});tx.update(visitRef,{updatedAt:now,updatedBy:user.uid});
  writeAuditLog(tx,{action:'visit.cancellationChargeReceiptRecorded',entityType:'visitCancellationChargeReceipt',entityId:key,user,studioId:v['studioId'],after:{visitId:d.visitId,jobId:d.jobId,receivedPaise:d.receivedPaise,balancePaise,invoiceId:invoice?.id??null}});
  return{receiptId:key,receivedPaise:d.receivedPaise,balancePaise,invoiceNumber:invoice?.invoiceNumber??null,alreadyRecorded:false};
 });
});

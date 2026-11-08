import {HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import type {Booking,ServiceJob} from '@autodeck/core';
import {cancellationTerms} from '@autodeck/core';
import type {AuthorizedUser} from '@autodeck/auth';
import {planRefund,readCancelReads,writeCancelRestores} from './cancel-booking.js';
import {requireCustomerDocId} from './customer-identity.js';
import {writeAuditLog} from '../middleware/audit.js';
/** Receipt-funded cancellation records the existing policy dues. No provider call,
 * invoice replacement, actual refund, store credit or collection occurs here. */
export async function cancelOfflineVisit(user:AuthorizedUser,data:{bookingId:string;reason:string;feeAction:'charge'|'waive';preview?:boolean|undefined},actor:'admin'|'customer'){
 const db=getFirestore(),ref=db.collection('bookings').doc(data.bookingId);
 const customerId=actor==='customer'?await requireCustomerDocId(db,'customers',user.claims.tenantId,user.uid):null;
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Booking not found.');const b=snap.data()as Booking;
  if(b.id!==data.bookingId||b.tenantId!==user.claims.tenantId||(actor==='customer'&&b.customerId!==customerId)||!['customer','admin','superadmin'].includes(user.claims.role))throw new HttpsError('permission-denied','Booking scope unavailable.');
  if(b.status==='CANCELLED')return{success:true,alreadyCancelled:true};
  if(['COMPLETED','EXPIRED'].includes(b.status)||b.advancePaymentId||b.cancelIntent)throw new HttpsError('failed-precondition','Booking payment or cancellation history needs office review.');
  const jobs=await tx.get(db.collection('jobs').where('bookingId','==',b.id).limit(2));if(jobs.size!==1)throw new HttpsError('failed-precondition','Exact receipt-funded job unavailable.');
  const doc=jobs.docs[0]!,job=doc.data()as ServiceJob,settlement=job.offlineSettlement;
  if(job.id!==doc.id||job.bookingId!==b.id||job.totalAmount!==b.totalAmount||job.tenantId!==b.tenantId||job.studioId!==b.studioId||job.customerId!==b.customerId||!settlement||!['PENDING_VEHICLE','VEHICLE_RECEIVED','STANDBY'].includes(job.status))throw new HttpsError('failed-precondition','Work started or receipt scope needs review.');
  if(!Number.isSafeInteger(settlement.appliedPaise)||settlement.appliedPaise<=0||settlement.appliedPaise>job.totalAmount||!Number.isSafeInteger(settlement.officeReturnDuePaise)||settlement.officeReturnDuePaise<0)throw new HttpsError('failed-precondition','Receipt balance needs review.');
  const [payments,receipts]=await Promise.all([tx.get(db.collection('payments').where('jobId','==',job.id).limit(2)),tx.get(db.collection('offlineReceipts').where('jobId','==',job.id).limit(101))]);
  const full=settlement.appliedPaise===job.totalAmount;
  if(receipts.size>100||receipts.size!==settlement.receiptCount||(!full&&(!payments.empty||job.paymentStatus!=="partial")))throw new HttpsError('failed-precondition','Existing payment or receipt history needs office review.');
  if(full){
   const payment=payments.docs[0]?.data();
   if(payments.size!==1||!payment||payment['offlineReceiptSettlement']!==true||payment['tenantId']!==job.tenantId||payment['studioId']!==job.studioId||payment['customerId']!==job.customerId||payment['bookingId']!==b.id||payment['amount']!==job.totalAmount||payment['status']!=='completed'||job.paymentStatus!=='paid'||typeof payment['invoiceId']!=='string')throw new HttpsError('failed-precondition','Settled receipt projection needs office review.');
   const invoice=(await tx.get(db.collection('invoices').doc(payment['invoiceId']))).data();
   if(!invoice||invoice['jobId']!==job.id||invoice['tenantId']!==job.tenantId||invoice['customerId']!==job.customerId||invoice['paymentId']!==payment['id']||invoice['total']!==job.totalAmount||invoice['status']!=='issued')throw new HttpsError('failed-precondition','Receipt invoice needs office review.');
  }
  let applied=0;for(const row of receipts.docs){const receipt=row.data();if(receipt['tenantId']!==job.tenantId||receipt['studioId']!==job.studioId||receipt['customerId']!==job.customerId||receipt['bookingId']!==b.id||!Number.isSafeInteger(receipt['appliedPaise'])||receipt['appliedPaise']<=0)throw new HttpsError('failed-precondition','Receipt history needs review.');applied+=receipt['appliedPaise'];}
  if(applied!==settlement.appliedPaise||!Number.isSafeInteger(applied))throw new HttpsError('failed-precondition','Receipt history needs review.');
  let categories=b.cancelCategories??[];if(!categories.length){const service=(await tx.get(db.collection('services').doc(b.serviceId))).data();categories=[String(service?.['category']??'')];}
  const terms=cancellationTerms({categories,totalPaise:b.totalAmount,scheduledAtMs:Date.parse(b.scheduledAt),nowMs:Date.now()});
  const plan=planRefund({paidPaise:applied,feePaise:terms.feePaise,waive:actor==='admin'&&data.feeAction==='waive'});
  const summary={paidPaise:plan.paidPaise,policyFeePaise:terms.feePaise,feePaise:plan.feePaise,feeStatus:plan.feeStatus,refundPaise:plan.refundPaise,method:'offline_receipts',manualRefund:plan.refundPaise>0};
  if(data.preview)return{preview:true,...summary};
  const obligation=db.collection('offlineReturnObligations').doc('cancel_'+job.id);if((await tx.get(obligation)).exists)throw new HttpsError('failed-precondition','Cancellation return already recorded.');
  const reads=await readCancelReads(tx,db,b,b.id),now=new Date().toISOString();
  const totalReturn=settlement.officeReturnDuePaise+plan.refundPaise;if(!Number.isSafeInteger(totalReturn))throw new HttpsError('failed-precondition','Return total needs office review.');
  writeCancelRestores(tx,reads,b,b.id,user,now,'Receipt-funded cancellation');
  if(plan.refundPaise>0)tx.create(obligation,{id:obligation.id,kind:'cancellation',tenantId:job.tenantId,studioId:job.studioId,jobId:job.id,bookingId:b.id,customerId:job.customerId,amountPaise:plan.refundPaise,status:'due',createdAt:now});
  tx.update(doc.ref,{status:'CANCELLED',statusHistory:[...(job.statusHistory??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:data.reason}],offlineSettlement:{...settlement,officeReturnDuePaise:totalReturn},updatedAt:now});
  tx.update(ref,{status:'CANCELLED',cancelledAt:now,cancelledBy:actor,cancellationReason:data.reason,cancellationFeePaise:plan.feePaise,cancellationFeeStatus:plan.feeStatus,offlineCancellation:true,manualRefundDuePaise:plan.refundPaise,refundedPaise:0,updatedAt:now});
  writeAuditLog(tx,{action:'booking.cancelled',entityType:'Booking',entityId:b.id,user,studioId:b.studioId,after:{...summary,offlineReceipts:true}});
  return{success:true,...summary};
 });
}

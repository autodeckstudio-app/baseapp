import {isDeepStrictEqual} from 'node:util';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {checkedCombinedPayment,combinedNoShowAmounts,combinedCancellationTerms,type Booking,type ServiceJob,type Payment} from '@autodeck/core';
import type {AuthorizedUser} from '@autodeck/auth';
import {combinedCheckoutEnabled} from './combined-booking.js';
import {readCancelReads,writeCancelRestores,planRefund} from './cancel-booking.js';
import {writeAuditLog} from '../middleware/audit.js';
import {allocateCombinedReturn,type CombinedReturn} from './combined-return-state.js';
export {allocateCombinedReturn,combinedReturnTotals,type CombinedReturn,type ReturnEntry} from './combined-return-state.js';
function fail(message:string):never{throw new HttpsError('failed-precondition',message);}
function amount(n:unknown):n is number{return typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;}
/** All reads are transactional, bounded and bound to the same booking/job/customer. Existing return history never gets reallocated. */
export async function readCombinedFunding(db:Firestore,tx:Transaction,b:Booking,allowOpen=false){
 if(!combinedCheckoutEnabled()||!b.combinedPayment)fail('Combined returns are not active.');
 let cp;try{cp=checkedCombinedPayment(b.combinedPayment,b.totalAmount);}catch{fail('Combined price snapshot needs review.');}
 const jobs=await tx.get(db.collection('jobs').where('bookingId','==',b.id).limit(2));if(jobs.size!==1)fail('Exactly one bound job is required.');const jobDoc=jobs.docs[0]!,j=jobDoc.data()as ServiceJob;
 if(j.id!==jobDoc.id||j.tenantId!==b.tenantId||j.studioId!==b.studioId||j.customerId!==b.customerId||j.totalAmount!==b.totalAmount||!isDeepStrictEqual(j.combinedPayment,b.combinedPayment)||!isDeepStrictEqual(j.priceBreakdown,b.priceBreakdown))fail('Combined job binding changed.');
 const transport=await tx.get(db.collection('pickupRequests').doc(b.id));const logistics=transport.data();if(logistics&&(logistics['tenantId']!==b.tenantId||logistics['customerId']!==b.customerId||logistics['studioId']!==b.studioId||logistics['bookingId']!==b.id))fail('Transport scope needs review.');if(logistics&&(logistics['status']==='DONE'||logistics['pickupCompletedAt']||logistics['dropCompletedAt']))fail('Used transport needs a separate reviewed adjustment. No unused-transport refund is assumed.');
 const [payments,receipts]=await Promise.all([tx.get(db.collection('payments').where('bookingId','==',b.id).limit(21)),tx.get(db.collection('offlineReceipts').where('jobId','==',j.id).limit(101))]);
 if(payments.size>20||receipts.size>100)fail('Funding history needs review.');
 const funding:{key:string;paymentId:string|null;method:string;capturedPaise:number;advance:boolean}[]=[],sources=new Map<string,Payment>(),openPayments:Payment[]=[];let advanceFound=false;let projection:Payment|null=null;
 for(const doc of payments.docs){const p=doc.data()as Payment&{offlineReceiptSettlement?:boolean;invoiceReviewNeeded?:boolean};if(p.id!==doc.id||p.tenantId!==b.tenantId||p.studioId!==b.studioId||p.customerId!==b.customerId||p.currency!==b.priceBreakdown.currency||p.bookingId!==b.id)fail('Payment funding scope changed.');if(p.status==='pending'||p.status==='processing'){if(!allowOpen)fail('An unresolved payment must finish its payment check before a return.');const expected=p.id===b.advancePaymentId&&cp.choice==='advance20'?p.targetType==='booking'&&p.jobId===null&&p.amount===cp.payNowPaise:p.targetType==='job'&&p.jobId===j.id&&p.amount===(cp.choice==='advance20'?cp.balancePaise:cp.totalPaise);if(!expected||p.method!=='razorpay_payment_link'||!p.razorpayPaymentLinkId||p.refundAmount||p.externalReturnRecordId||p.overpayments?.length||p.invoiceReviewNeeded)fail('Open payment binding needs review.');openPayments.push(p);continue;}if(p.status==='failed'||p.status==='cancelled')continue;if(p.status!=='completed'||p.refundAmount||p.externalReturnRecordId||p.overpayments?.length||p.invoiceReviewNeeded)fail('Existing payment return or anomaly needs review.');if(!amount(p.amount)||p.amount<=0)fail('Captured amount is invalid.');
  if(p.offlineReceiptSettlement){if(projection||p.jobId!==j.id||p.amount!==j.offlineSettlement?.appliedPaise)fail('Receipt settlement projection needs review.');projection=p;continue;}
  const advance=p.id===b.advancePaymentId;
  if(advance){if(cp.choice!=='advance20'||p.targetType!=='booking'||p.jobId!==null||p.amount!==cp.payNowPaise||!b.advancePaidAt||p.method!=='razorpay_payment_link')fail('Advance evidence changed.');advanceFound=true;}else if(p.targetType!=='job'||p.jobId!==j.id||p.amount>(cp.choice==='advance20'?cp.balancePaise:cp.totalPaise))fail('Balance payment binding changed.');
  if(p.method==='razorpay_payment_link'&&!p.razorpayPaymentId)fail('Provider capture identity is missing.');
  if(!['razorpay_payment_link','cash','upi_manual','bank_transfer'].includes(p.method))fail('Funding method needs review.');
  const refunds=await tx.get(db.collection('refundRequests').where('paymentId','==',p.id).limit(21));const marker=await tx.get(db.collection('paymentEvents').doc(`refund_${p.id}`));if(refunds.size>20||refunds.docs.some(d=>d.data()['status']!=='failed')||marker.exists)fail('Existing refund review prevents reallocation.');
  sources.set(p.id,p);funding.push({key:p.id,paymentId:p.id,method:p.method,capturedPaise:p.amount,advance});
 }
 let receiptPaid=0;for(const row of receipts.docs){const r=row.data();if(r['tenantId']!==b.tenantId||r['studioId']!==b.studioId||r['customerId']!==b.customerId||r['bookingId']!==b.id||r['jobId']!==j.id||r['method']!=='cash'||!amount(r['appliedPaise'])||r['appliedPaise']<=0)fail('Actual receipt funding needs review.');receiptPaid+=r['appliedPaise'];}
 if(receiptPaid){if(!j.offlineSettlement||receiptPaid!==j.offlineSettlement.appliedPaise||receipts.size!==j.offlineSettlement.receiptCount)fail('Actual receipt ledger does not reconcile.');funding.push({key:`receipts_${j.id}`,paymentId:projection?.id??null,method:'cash',capturedPaise:receiptPaid,advance:false});}else if(j.offlineSettlement?.appliedPaise)fail('Actual receipt ledger is missing.');
 const paidPaise=funding.reduce((n,f)=>n+f.capturedPaise,0);if(projection&&!receiptPaid)fail('Receipt projection has no actual funding.');
 if(!amount(paidPaise)||paidPaise>b.totalAmount||funding.filter(f=>!f.advance&&f.method==='razorpay_payment_link').length>1||(cp.choice==='advance20'&&paidPaise>0&&!advanceFound))fail('Funding does not reconcile to the combined visit.');
 return{j,jobDoc,funding,sources,paidPaise,openPayments};
}
export async function decideCombinedReturn(db:Firestore,user:AuthorizedUser,data:{bookingId:string;reason:string;feeAction:'charge'|'waive';preview?:boolean|undefined;paymentCheck?:{confirmed:true;note:string}|undefined},actor:'admin'|'customer',kind:'cancellation'|'no_show',chargePaise?:number|null):Promise<{success?:boolean;[key:string]:unknown}>{
 return db.runTransaction(async tx=>{
  const ref=db.collection('bookings').doc(data.bookingId),b=(await tx.get(ref)).data()as Booking&{combinedReturn?:CombinedReturn;noShowResolution?:string}|undefined;
  if(!b)throw new HttpsError('not-found','Booking not found.');if(!['admin','superadmin','customer'].includes(user.claims.role)||b.tenantId!==user.claims.tenantId||(user.claims.studioId&&user.claims.studioId!==b.studioId))throw new HttpsError('permission-denied','Booking scope unavailable.');
  if(actor==='customer'){const c=(await tx.get(db.collection('customers').doc(b.customerId))).data();if(!c||c['authUid']!==user.uid||c['tenantId']!==b.tenantId||c['deletedAt'])throw new HttpsError('permission-denied','Customer scope changed.');}
  if(b.combinedReturn)return{success:true,alreadyCancelled:true,...b.combinedReturn};
  if(kind==='no_show'?(b.status!=='CANCELLED'||!b.missedAt||b.noShowResolution):['CANCELLED','EXPIRED','COMPLETED'].includes(b.status))fail('Booking status does not allow this decision.');
  const intentRef=db.collection('bookingCancelIntents').doc(b.id),intentDoc=await tx.get(intentRef),intent=intentDoc.data();const waiting=b.cancelIntent?.state==='waiting'||b.cancelIntent?.state==='needs_review';if(waiting&&(actor!=='admin'||!intent||intent['version']!==2||intent['tenantId']!==b.tenantId||intent['studioId']!==b.studioId||intent['customerId']!==b.customerId||!['waiting','needs_review'].includes(intent['state'])))fail('Admin must review the waiting payment check.');if(waiting&&(!data.paymentCheck?.confirmed||data.paymentCheck.note.trim().length<3))fail('Confirm the original payment check and record its evidence before cancellation review.');
  const f=await readCombinedFunding(db,tx,b);if(kind==='cancellation'&&!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(f.j.status))fail('Work has started. Admin must review the visit.');
  let categories=b.cancelCategories??[];if(!categories.length){const service=(await tx.get(db.collection('services').doc(b.serviceId))).data();categories=[String(service?.['category']??'')];}
  const policyFeePaise=kind==='no_show'?combinedNoShowAmounts(b.priceBreakdown,f.paidPaise).retainedPaise:combinedCancellationTerms(b.priceBreakdown,{categories,scheduledAtMs:Date.parse(b.scheduledAt),nowMs:Date.now()}).feePaise;
  if(kind==='no_show'&&data.feeAction==='charge'&&chargePaise!==null&&chargePaise!==undefined&&chargePaise!==policyFeePaise)throw new HttpsError('invalid-argument','No-show retention is 20% of service only.');
  const financial=planRefund({paidPaise:f.paidPaise,feePaise:policyFeePaise,waive:data.feeAction==='waive'}),entries=allocateCombinedReturn(f.funding,financial.feePaise),now=new Date().toISOString();
  const plan:CombinedReturn={version:2,kind,jobId:f.j.id,paidPaise:f.paidPaise,feePaise:f.paidPaise?financial.feePaise:0,refundPaise:financial.refundPaise,entries,status:'awaiting_admin',reason:data.reason,createdAt:now,approvedBy:null,approvedAt:null};
  const summary={...financial,policyFeePaise,method:'combined_original_methods',manualRefund:entries.some(e=>e.method!=='razorpay_payment_link'&&e.returnPaise>0),allocation:entries};if(data.preview)return{preview:true,...summary};
  const reads=kind==='cancellation'?await readCancelReads(tx,db,b,b.id):null;
  if(waiting){tx.update(intentRef,{state:'resolved',resolution:'combined_cancel_reviewed',resolvedAt:now,resolvedBy:user.uid,paymentCheckNote:data.paymentCheck!.note,paymentCheckBy:user.uid,paymentCheckedAt:now});tx.update(ref,{cancelIntent:{state:'resolved',requestedAt:intent!['requestedAt']}});}
  if(reads)writeCancelRestores(tx,reads,b,b.id,user,now,'Combined booking cancelled');
  tx.update(ref,{combinedReturn:plan,...(kind==='cancellation'?{status:'CANCELLED',cancelledAt:now,cancelledBy:actor,cancellationReason:data.reason,cancellationFeePaise:financial.feePaise,cancellationFeeStatus:financial.feeStatus}:{noShowResolution:data.feeAction==='waive'?'waive':'charge',noShowChargePaise:financial.feePaise,noShowResolvedAt:now,noShowResolvedBy:user.uid,noShowReason:data.reason}),manualRefundDuePaise:entries.filter(e=>e.method!=='razorpay_payment_link').reduce((n,e)=>n+e.returnPaise,0),refundedPaise:0,refundStatus:financial.refundPaise>0?'awaiting_approval':'none',updatedAt:now});
  if(kind==='cancellation')tx.update(f.jobDoc.ref,{status:'CANCELLED',statusHistory:[...(f.j.statusHistory??[]),{status:'CANCELLED',changedAt:now,changedBy:user.uid,notes:data.reason}],updatedAt:now});
  writeAuditLog(tx,{action:kind==='no_show'?'booking.noshow_resolved':'booking.cancelled',entityType:'Booking',entityId:b.id,user,studioId:b.studioId,after:{feePaise:financial.feePaise,refundReviewPaise:financial.refundPaise,originalMethods:true}});
  return{success:true,resolved:kind==='no_show',resolution:data.feeAction==='waive'?'waive':'charge',chargePaise:financial.feePaise,refundRequestId:null,...summary};
 });
}

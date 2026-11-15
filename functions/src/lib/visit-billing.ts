import{readCancelledGiftService}from'./visit-gift-cancellation.js';
import {readCancelledCoveredService} from './visit-covered-cancellation.js';
import { visitReturnHash, readCancelledVisitReturn } from './visit-service-return-state.js';
import{readCoveredLink,exactCoveredInvoice}from'./membership-covered.js';
import{readVisitOnlineProof}from'./visit-online-proof.js';
import{buildInvoice}from'./invoice-builder.js';
import{isDeepStrictEqual}from'node:util';
import {createHash} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {sharedVisitState,type SharedVisit,type Invoice,type Payment} from '@autodeck/core';
import {readVisitMember} from './shared-visit-members.js';
import {readConsultPaymentBinding} from './consult-payment.js';

const validId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const money=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const fail=(message='Visit bill needs office review.'):never=>{throw new HttpsError('failed-precondition',message);};
/** Read original obligations and actual funding in one transaction. A review
 * token binds membership, prices and money evidence. It is not a receipt,
 * invoice issue, collection claim or permission to call a provider. */
export async function readVisitBilling(tx:Transaction,db:Firestore,visitId:string,providerAttemptId?:string){
 if(!validId(visitId))return fail();
 const ref=db.collection('carVisits').doc(visitId),raw=(await tx.get(ref)).data();
 if(!raw||raw['id']!==visitId||!Array.isArray(raw['jobIds'])||!raw['jobIds'].length||raw['jobIds'].length>20||raw['jobIds'].some((id:unknown)=>!validId(id)))return fail();
 const visit=raw as SharedVisit;
 // No current callable creates this lock. The disabled provider adapter uses
 // one durable head so another receipt cannot collect the same balance while
 // link creation, capture or reconciliation is unresolved.
 const providerHead=(await tx.get(db.collection('visitProviderHeads').doc(visitId))).data();
 if(providerHead){
  if(providerHead['visitId']!==visitId||providerHead['tenantId']!==visit.tenantId||!validId(providerHead['attemptId']))return fail('Visit provider payment needs reconciliation before collecting.');
  if(providerHead['attemptId']!==providerAttemptId){
   if(providerHead['status']!=='settled'||!validId(providerHead['receiptId']))return fail('Visit provider payment needs reconciliation before collecting.');
   const proof=await readVisitOnlineProof(tx,db,providerHead['receiptId']);
   if(proof.receipt['visitId']!==visitId||proof.receipt['attemptId']!==providerHead['attemptId']||proof.receipt['tenantId']!==visit.tenantId)return fail('Visit provider settlement needs review.');
  }
 }
 if(providerAttemptId&&!providerHead)return fail('Visit provider payment claim is missing.');
 const members=await Promise.all(visit.jobIds.map(id=>readVisitMember(tx,db,id)));
 if(sharedVisitState(visit,members.map(m=>m.member))==='needs_review')return fail('Visit changed. Review before collecting.');
 const transportOwners=members.filter(m=>m.member.transportRequested||m.member.pickupFee>0||m.member.dropFee>0);
 if(transportOwners.length>1||visit.transportJobId!==null&&!visit.jobIds.includes(visit.transportJobId)||transportOwners.some(m=>m.job.id!==visit.transportJobId))return fail('Shared transport ownership needs review.');
 const[customer,car]=await Promise.all([tx.get(db.collection('customers').doc(visit.customerId)),tx.get(db.collection('vehicles').doc(visit.vehicleId))]);
 if(!customer.exists||customer.data()?.['tenantId']!==visit.tenantId||customer.data()?.['deletedAt']||!car.exists||car.data()?.['ownerId']!==visit.customerId||car.data()?.['tenantId']!==visit.tenantId||car.data()?.['deletedAt'])return fail('Visit ownership changed.');
 const sharedInvoices=new Map<string,Record<string,any>>();
 const sources:unknown[]=[],lines:{jobId:string;bookingId:string|null;name:string;amountPaise:number;appliedPaise:number;cancelled:boolean;invoiceId:string|null;invoiceNumber:string|null;visitInvoiceId:string|null;taxPaise:number|null;additionalPaise:number}[]=[];
 const fundingIds=new Set<string>(),verifiedReceiptIds=new Set<string>();
 const benefitReviews:{jobId:string;benefit:'covered'|'gift';decision:'restore_wash'|'restore_original_gift'|'keep_refunded'|'keep_void';returnedPaise:number}[]=[];
 const moneyTokens=new Map<string,string>(),returnReviews:Awaited<ReturnType<typeof readCancelledVisitReturn>>[]=[];
 for(const {job,member,booking}of members){
  if(member.quotePending||member.paymentInFlight||member.cancellationPending||job.cashReconciliationId||job.paymentStatus==='refunded'||!money(job.totalAmount)||!money(job.additionalWorkDelta)||!job.priceBreakdown||job.priceBreakdown.currency!=='INR'||!money(job.priceBreakdown.total)||!money(job.priceBreakdown.tax)||job.priceBreakdown.total+job.additionalWorkDelta!==job.totalAmount)return fail('Service amount or payment needs review.');
  if(job.status==='CANCELLED'&&booking?.['cancellationFeeStatus']==='due'&&booking['cancellationFeePaise']>0)return fail('Cancellation fee settlement needs review.');
  if(booking&&['CANCELLED','EXPIRED'].includes(booking['status'])&&job.status!=='CANCELLED')return fail('Booking status changed.');
  if(booking&&job.status!=='CANCELLED')await readConsultPaymentBinding(db,tx,job,booking);
  const approvals=await tx.get(db.collection('approvals').where('jobId','==',job.id).limit(101));
  if(approvals.size>100||approvals.docs.some(d=>d.data()['status']==='pending'))return fail('Review pending additional work before collecting.');
  let additions=0;for(const a of approvals.docs){const v=a.data();if(v['status']!=='approved')continue;if(v['id']!==a.id||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>v[k]!==job[k])||!money(v['priceImpact']))return fail('Approved work binding changed.');additions+=v['priceImpact'];}
  if(!money(additions)||additions!==job.additionalWorkDelta)return fail('Approved additions do not reconcile.');
  const[pays,bookingPays,receipts,invoices]=await Promise.all([tx.get(db.collection('payments').where('jobId','==',job.id).limit(21)),job.bookingId?tx.get(db.collection('payments').where('bookingId','==',job.bookingId).limit(21)):Promise.resolve(null),tx.get(db.collection('offlineReceipts').where('jobId','==',job.id).limit(101)),tx.get(db.collection('invoices').where('jobId','==',job.id).limit(3))]);
  if(pays.size>20||(bookingPays?.size??0)>20||receipts.size>100||invoices.size>2)return fail('Funding history exceeds the reviewed limit.');
  const paymentDocs=[...new Map([...pays.docs,...(bookingPays?.docs??[])].map(d=>[d.id,d])).values()];
  const live=invoices.docs.filter(d=>d.data()['status']!=='void');if(live.length>1)return fail('Multiple original invoices need review.');
  const inv=live[0]?.data() as Invoice|undefined;
  if(inv&&(inv.id!==live[0]!.id||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>inv[k]!==job[k])||inv.jobId!==job.id||inv.total!==job.totalAmount||inv.currency!=='INR'||inv.status==='draft'||!money(inv.subtotal)||!money(inv.discount)||!money(inv.tax)||!Number.isSafeInteger(inv.roundOffPaise??0)||inv.subtotal-inv.discount+inv.tax+(inv.roundOffPaise??0)!==inv.total))return fail('Original invoice needs review.');
  let visitInvoice:Record<string,any>|null=null,visitComponent:Record<string,any>|null=null;
  if(job.visitInvoiceId){
   if(inv||!validId(job.visitInvoiceId))return fail('Invoice identities need review.');
   visitInvoice=(await tx.get(db.collection('visitInvoices').doc(job.visitInvoiceId))).data()??null;
   const vi=visitInvoice;
   if(!vi||vi['id']!==job.visitInvoiceId||vi['kind']!=='shared_visit_invoice'||vi['status']!=='issued'||vi['sharedVisitId']!==visit.id||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>vi[k]!==job[k])||vi['currency']!=='INR'||!validId(vi['receiptId'])||typeof vi['invoiceNumber']!=='string'||!vi['invoiceNumber']||!Array.isArray(vi['components'])||!vi['components'].length||vi['components'].length>20||new Set(vi['components'].map((c:any)=>c.jobId)).size!==vi['components'].length||vi['components'].some((c:any)=>!visit.jobIds.includes(c.jobId)||!money(c.amountPaise)||!money(c.subtotalPaise)||!money(c.discountPaise)||!money(c.taxPaise)||!Number.isSafeInteger(c.roundOffPaise)||c.subtotalPaise-c.discountPaise+c.taxPaise+c.roundOffPaise!==c.amountPaise)||!['totalPaise','subtotalPaise','discountPaise','taxPaise'].every(k=>money(vi[k]))||!Number.isSafeInteger(vi['roundOffPaise'])||vi['components'].reduce((n:number,c:any)=>n+c.amountPaise,0)!==vi['totalPaise']||vi['components'].reduce((n:number,c:any)=>n+c.subtotalPaise,0)!==vi['subtotalPaise']||vi['components'].reduce((n:number,c:any)=>n+c.discountPaise,0)!==vi['discountPaise']||vi['components'].reduce((n:number,c:any)=>n+c.taxPaise,0)!==vi['taxPaise']||vi['components'].reduce((n:number,c:any)=>n+c.roundOffPaise,0)!==vi['roundOffPaise'])return fail('Consolidated invoice needs review.');
   visitComponent=vi['components'].find((c:any)=>c.jobId===job.id)??null;
   if(!visitComponent||visitComponent['bookingId']!==job.bookingId||visitComponent['amountPaise']!==job.totalAmount)return fail('Consolidated invoice service changed.');
   const original=buildInvoice({invoiceId:'check',invoiceNumber:'Check original snapshot',tenantId:job.tenantId,studioId:job.studioId,jobId:job.id,bookingId:job.bookingId,customerId:job.customerId,vehicleId:job.vehicleId,priceBreakdown:job.priceBreakdown,paymentId:null,serviceName:visitComponent['lineItems']?.[0]?.serviceName??'',serviceId:job.serviceId,additionalWork:approvals.docs.filter(d=>d.data()['status']==='approved').map(d=>d.data()as any)});
   if(original.subtotal!==visitComponent['subtotalPaise']||original.discount!==visitComponent['discountPaise']||original.tax!==visitComponent['taxPaise']||(original.roundOffPaise??0)!==visitComponent['roundOffPaise']||original.taxRatePercent!==visitComponent['taxRatePercent']||original.taxDescription!==visitComponent['taxDescription']||!isDeepStrictEqual(original.lineItems,visitComponent['lineItems']))return fail('Consolidated invoice original snapshot changed.');
   if(vi['receiptSource']==='visit_online_receipt'){
    const proof=await readVisitOnlineProof(tx,db,vi['receiptId']);
    if(proof.receipt['visitId']!==visit.id||proof.receipt['tenantId']!==job.tenantId||proof.receipt['invoiceId']!==vi['id'])return fail('Consolidated online receipt is missing.');
   }else{
    if(vi['receiptSource']!==undefined)return fail('Unknown consolidated receipt source.');
    const receipt=(await tx.get(db.collection('visitReceipts').doc(vi['receiptId']))).data();
    if(!receipt||receipt['visitId']!==visit.id||receipt['tenantId']!==job.tenantId||receipt['result']?.invoiceId!==vi['id']||receipt['result']?.balancePaise!==0)return fail('Consolidated invoice receipt is missing.');
   }
  }
  let applied=0,actualReceipts=0,receiptExcess=0;const completed=new Map<string,Payment>();
  for(const r of receipts.docs){const v=r.data();if(v['id']!==undefined&&v['id']!==r.id||(['tenantId','studioId','customerId']as const).some(k=>v[k]!==job[k])||v['jobId']!==job.id||v['bookingId']!==job.bookingId||!['cash','upi_manual','bank_transfer'].includes(v['method'])||!money(v['appliedPaise'])||!money(v['receivedPaise'])||!money(v['officeReturnDuePaise'])||v['receivedPaise']!==v['appliedPaise']+v['officeReturnDuePaise'])return fail('Original receipt needs review.');if(v['visitReceiptId']){
    if(!validId(v['visitReceiptId'])||v['visitId']!==visit.id||!validId(v['billId']))return fail('Visit receipt application needs review.');
    const parent=(await tx.get(db.collection('visitReceipts').doc(v['visitReceiptId']))).data();
    if(!parent||parent['id']!==v['visitReceiptId']||parent['kind']!=='visit_actual_receipt'||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>parent[k]!==job[k])||parent['visitId']!==visit.id||parent['billId']!==v['billId']||parent['method']!==v['method']||parent['reference']!==v['reference']||!Array.isArray(parent['applications'])||!parent['applications'].length||parent['applications'].length>visit.jobIds.length||new Set(parent['applications'].map((a:any)=>a.jobId)).size!==parent['applications'].length||new Set(parent['applications'].map((a:any)=>a.applicationId)).size!==parent['applications'].length||parent['applications'].some((a:any)=>!visit.jobIds.includes(a.jobId)||!validId(a.applicationId)||!money(a.appliedPaise)||!a.appliedPaise)||!money(parent['receivedPaise'])||parent['applications'].reduce((n:number,a:any)=>n+a.appliedPaise,0)!==parent['receivedPaise'])return fail('Original visit receipt needs review.');
    if(parent['currency']!=='INR'||!Number.isFinite(Date.parse(parent['createdAt'])))return fail('Original visit receipt currency or time needs review.');
    if(!verifiedReceiptIds.has(v['visitReceiptId'])){
     // A receipt is one money fact, not a set of independently believable rows.
     // Query by original identity so an extra application outside this visit is
     // also visible. Never make missing money collectible again from a partial
     // child set, even when an individual job projection was changed with it.
     const siblings=await tx.get(db.collection('offlineReceipts').where('visitReceiptId','==',v['visitReceiptId']).limit(21));
     if(siblings.size!==parent['applications'].length)return fail('Visit receipt application set needs review.');
     for(const sibling of siblings.docs){const s=sibling.data(),a=parent['applications'].find((a:any)=>a.applicationId===sibling.id),owner=members.find(m=>m.job.id===s['jobId']);
      if(!a||!owner||a.jobId!==s['jobId']||s['id']!==sibling.id||s['bookingId']!==owner.job.bookingId||a.appliedPaise!==s['receivedPaise']||a.appliedPaise!==s['appliedPaise']||s['officeReturnDuePaise']!==0||!money(s['balanceDuePaise'])||['tenantId','studioId','customerId','visitId','billId','method','reference','createdAt','recordedBy'].some(k=>s[k]!==parent[k]))return fail('Visit receipt sibling application needs review.');
     }
     verifiedReceiptIds.add(v['visitReceiptId']);
    }
    const match=parent['applications'].filter((a:any)=>a.jobId===job.id&&a.applicationId===r.id&&a.appliedPaise===v['appliedPaise']);if(match.length!==1)return fail('Original visit receipt allocation changed.');
   }
   actualReceipts+=v['appliedPaise'];receiptExcess+=v['officeReturnDuePaise'];}
  if(!money(actualReceipts)||!money(receiptExcess)||actualReceipts!==(job.offlineSettlement?.appliedPaise??0)||receipts.size!==(job.offlineSettlement?.receiptCount??0)||receiptExcess!==(job.offlineSettlement?.officeReturnDuePaise??0)||receiptExcess>0)return fail('Receipt balance or money still owed needs review.');
  let projection:Payment|null=null;
  for(const d of paymentDocs){const p=d.data()as Payment&{invoiceReviewNeeded?:boolean};
   if(p.id!==d.id||(['tenantId','studioId','customerId']as const).some(k=>p[k]!==job[k])||p.currency!=='INR'||p.bookingId!==job.bookingId||p.jobId!==job.id&&!(p.targetType==='booking'&&p.jobId===null&&booking?.['advancePaymentId']===p.id))return fail('Original payment binding changed.');
   if(['failed','cancelled'].includes(p.status)){if(p.razorpayPaymentId||p.refundAmount||p.overpayments?.length||p.externalReturnRecordId)return fail('Closed payment contains money to review.');continue;}
   if(!['razorpay_payment_link','cash','upi_manual','bank_transfer'].includes(p.method)||p.jobId===job.id&&p.targetType!=='job'||p.status!=='completed'||!money(p.amount)||p.amount<=0||p.refundAmount||p.externalReturnRecordId||p.overpayments?.length||p.invoiceReviewNeeded||p.orderAmbiguous||p.linkCreateLeaseId||p.method==='razorpay_payment_link'&&!p.razorpayPaymentId)return fail('Payment or original-method return needs review.');
   const[refunds,marker]=await Promise.all([tx.get(db.collection('refundRequests').where('paymentId','==',p.id).limit(21)),tx.get(db.collection('paymentEvents').doc('refund_'+p.id))]);
   const claim=marker.data();
   const ownReturnClaim=claim?.['kind']==='visit_service_return_owned'&&job.status==='CANCELLED'&&booking?.['visitServiceReturnId']===job.id&&
    claim['returnId']===job.id&&claim['jobId']===job.id&&claim['paymentId']===p.id&&claim['bookingId']===job.bookingId&&claim['tenantId']===job.tenantId&&claim['visitId']===visit.id;
   if(marker.exists&&!ownReturnClaim||refunds.size>20||refunds.docs.some(d=>d.data()['status']!=='failed'))return fail('An original payment return is unresolved.');
   if(p.offlineReceiptSettlement){if(projection||p.amount!==actualReceipts||!receipts.size)return fail('Receipt settlement projection changed.');projection=p;continue;}
   if(fundingIds.has(p.id))return fail('One original payment cannot fund two services.');fundingIds.add(p.id);completed.set(p.id,p);applied+=p.amount;
  }
  let onlineApplied=0;const onlineProofs:unknown[]=[];
  const online=(await tx.get(db.collection('visitOnlineApplications').where('jobId','==',job.id).limit(21)));
  if(online.size>1)return fail('Online receipt history needs review.');
  for(const doc of online.docs){const a=doc.data();if(!validId(a['receiptId']))return fail('Online receipt identity needs review.');
   const proof=await readVisitOnlineProof(tx,db,a['receiptId']);
   if(!proof.applications.some(row=>row['id']===doc.id&&row['jobId']===job.id)||proof.receipt['visitId']!==visit.id||proof.receipt['customerId']!==job.customerId||proof.receipt['tenantId']!==job.tenantId||proof.receipt['studioId']!==job.studioId||proof.receipt['invoiceId']!==job.visitInvoiceId||visitInvoice?.['receiptSource']!=='visit_online_receipt'||visitInvoice['receiptId']!==a['receiptId'])return fail('Online receipt application needs review.');
   onlineProofs.push(proof);onlineApplied+=a['appliedPaise'];
  }
  applied+=actualReceipts+onlineApplied;if(!money(applied)||applied>job.totalAmount)return fail('Money exceeds the verified original obligation.');
  const expectedStatus=applied===job.totalAmount&&job.totalAmount>0?'paid':applied>0?'partial':'unpaid';
  if(job.settlementKind==='membership_covered'){
   // Covered zero-price invoices remain visible but never become a cash due.
   if(job.totalAmount!==0||applied!==0||!inv||inv.settlementKind!=='membership_covered'||!inv.membershipId||inv.paymentId!==null||job.paymentStatus!=='paid')return fail('Covered service needs its original settlement review.');
   if(job.status==='CANCELLED'){await readCancelledCoveredService(tx,db,job,booking!,inv);benefitReviews.push({jobId:job.id,benefit:'covered',decision:'restore_wash',returnedPaise:0});}
   else {const covered=await readCoveredLink(db,tx,job);if(!exactCoveredInvoice(inv,job,covered.booking,covered.membershipId)||covered.booking.paymentStatus!=='paid')return fail('Covered service original linkage changed.');}
  }else if(job.paymentStatus!==expectedStatus)return fail('Payment projection does not match original funding.');
  if(inv&&job.settlementKind!=='membership_covered'){
   if(applied!==job.totalAmount||job.invoiceId!==inv.id)return fail('Invoice and collected balance differ.');
   const final=projection??(inv.paymentId?completed.get(inv.paymentId):undefined);if(!final||final.id!==inv.paymentId||final.invoiceId!==inv.id)return fail('Original invoice payment link is missing.');
   if(inv.paymentAllocation){const a=inv.paymentAllocation,advance=completed.get(a.advancePaymentId);if(!advance||advance.invoiceId!==inv.id||a.settlementPaymentId!==final.id||advance.amount!==a.advancePaidPaise||final.amount!==a.settlementPaidPaise||a.advancePaidPaise+a.settlementPaidPaise!==inv.total)return fail('Original split settlement changed.');}
   else if(final.amount!==inv.total||completed.size+(projection?1:0)!==1)return fail('Original payment does not settle this invoice.');
  }else if(applied===job.totalAmount&&job.totalAmount>0&&!visitInvoice)return fail('Settled service has no verified original invoice.');
  if(visitInvoice&&applied!==job.totalAmount)return fail('Consolidated invoice funding changed.');
  if(visitInvoice)sharedInvoices.set(visitInvoice['id'],{id:visitInvoice['id'],invoiceNumber:visitInvoice['invoiceNumber'],issuedAt:visitInvoice['issuedAt'],currency:'INR',totalPaise:visitInvoice['totalPaise'],subtotalPaise:visitInvoice['subtotalPaise'],discountPaise:visitInvoice['discountPaise'],taxPaise:visitInvoice['taxPaise'],roundOffPaise:visitInvoice['roundOffPaise'],customerSnapshot:visitInvoice['customerSnapshot'],vehicleSnapshot:visitInvoice['vehicleSnapshot'],...(visitInvoice['issuerSnapshot']?{issuerSnapshot:visitInvoice['issuerSnapshot']}:{}),components:visitInvoice['components']});
  if(job.status==='CANCELLED'&&(job as any).visitGiftCancellationId){if(!booking)return fail();benefitReviews.push(await readCancelledGiftService(tx,db,job,booking));}
  const moneyToken=visitReturnHash({job:{id:job.id,tenantId:job.tenantId,studioId:job.studioId,customerId:job.customerId,vehicleId:job.vehicleId,bookingId:job.bookingId,serviceId:job.serviceId,totalAmount:job.totalAmount,priceBreakdown:job.priceBreakdown,additionalWorkDelta:job.additionalWorkDelta,paymentStatus:job.paymentStatus,invoiceId:job.invoiceId??null,visitInvoiceId:job.visitInvoiceId??null,offlineSettlement:job.offlineSettlement??null},onlineProofs,booking:booking?{totalAmount:booking['totalAmount'],priceBreakdown:booking['priceBreakdown']??null,combinedPayment:booking['combinedPayment']??null,advancePaymentId:booking['advancePaymentId']??null}:null,visitInvoice,approvals:approvals.docs.map(d=>({id:d.id,...d.data()})),payments:paymentDocs.map(d=>({id:d.id,...d.data()})),receipts:receipts.docs.map(d=>({id:d.id,...d.data()})),online:online.docs.map(d=>({id:d.id,...d.data()})),invoices:invoices.docs.map(d=>({id:d.id,...d.data()}))});
  moneyTokens.set(job.id,moneyToken);
  if(job.status==='CANCELLED'&&(applied>0||(job as typeof job & {visitServiceReturnId?:string}).visitServiceReturnId||booking?.['manualRefundDuePaise']||booking?.['refundStatus']&&booking['refundStatus']!=='none')){
   if(!booking||!booking['visitServiceReturnId'])return fail('Cancelled service money needs original-method review.');
   returnReviews.push(await readCancelledVisitReturn(tx,db,{visitId:visit.id,jobId:job.id,job,booking,originalPayments:paymentDocs.filter(d=>d.data()['status']==='completed').map(d=>({id:d.id,amount:d.data()['amount']})),appliedPaise:applied,invoiceId:inv?.id??job.visitInvoiceId??null,moneyToken}));
  }
  lines.push({jobId:job.id,bookingId:job.bookingId,name:job.lines?.map(l=>l.name).join(' + ')||'Service',amountPaise:job.totalAmount,appliedPaise:applied,cancelled:job.status==='CANCELLED',visitInvoiceId:job.visitInvoiceId??null,invoiceId:inv?.id??job.visitInvoiceId??null,invoiceNumber:inv?.invoiceNumber??visitInvoice?.['invoiceNumber']??null,taxPaise:inv?.tax??visitComponent?.['taxPaise']??(additions?null:job.priceBreakdown.tax),additionalPaise:additions});
  sources.push({job,visitInvoice,booking:booking??null,approvals:approvals.docs.map(d=>({id:d.id,...d.data()})),payments:paymentDocs.map(d=>({id:d.id,...d.data()})),receipts:receipts.docs.map(d=>({id:d.id,...d.data()})),online:online.docs.map(d=>({id:d.id,...d.data()})),invoices:invoices.docs.map(d=>({id:d.id,...d.data()}))});
 }
 const active=lines.filter(l=>!l.cancelled),totalPaise=active.reduce((n,l)=>n+l.amountPaise,0),appliedPaise=active.reduce((n,l)=>n+l.appliedPaise,0);
 if(!money(totalPaise)||!money(appliedPaise)||appliedPaise>totalPaise)return fail();
 const reviewToken=createHash('sha256').update(JSON.stringify({visit,sources})).digest('hex');
 return{visit,members,moneyTokens,returnReviews,benefitReviews,review:{visitId:visit.id,revision:visit.revision,reviewToken,currency:'INR' as const,sharedInvoices:[...sharedInvoices.values()],totalPaise,appliedPaise,balancePaise:totalPaise-appliedPaise,lines}};
}

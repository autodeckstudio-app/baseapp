import{readConsultPaymentBinding}from"./consult-payment.js";
import{isDeepStrictEqual}from "node:util";
import {HttpsError}from'firebase-functions/v2/https';
import type{Firestore,Transaction}from'firebase-admin/firestore';
import{checkedCombinedPayment,type Booking,type ServiceJob,type Payment}from'@autodeck/core';
import{COLLECTIONS}from'@autodeck/database';
import{combinedCheckoutEnabled}from'./combined-booking.js';
export type CombinedPaymentBasis={version:2;totalPaise:number;advancePaymentId:string|null;advanceCapturedPaise:number;balanceDuePaise:number};
/** Reads actual bound captured money, not a display marker or a client-supplied subtraction. Reads before any caller writes. */
export async function readCombinedPaymentBasis(db:Firestore,tx:Transaction,job:ServiceJob):Promise<CombinedPaymentBasis|null>{
 if(!job.combinedPayment)return null;
 if(!combinedCheckoutEnabled())throw new HttpsError('failed-precondition','Combined payments are not active.');
 let snapshot;try{snapshot=checkedCombinedPayment(job.combinedPayment,job.totalAmount)}catch{throw new HttpsError('failed-precondition','Combined price changed. Office review is required.');}
 if(!job.bookingId)throw new HttpsError('failed-precondition','Combined booking binding is missing.');
 const b=(await tx.get(db.collection(COLLECTIONS.bookings()).doc(job.bookingId))).data()as Booking|undefined;
 if(!b||b.tenantId!==job.tenantId||b.studioId!==job.studioId||b.customerId!==job.customerId||b.totalAmount!==job.totalAmount||!isDeepStrictEqual(b.combinedPayment,job.combinedPayment)||['CANCELLED','EXPIRED'].includes(b.status)||(b as any).cancelIntent?.state==='waiting'||(b as any).cancelIntent?.state==='needs_review')throw new HttpsError('failed-precondition','Booking settlement needs office review.');
 if(b.status==='PENDING'&&(!b.holdExpiresAt||!Number.isFinite(Date.parse(b.holdExpiresAt))||Date.parse(b.holdExpiresAt)<=Date.now()))throw new HttpsError('failed-precondition','Booking hold expired. Review availability before paying.');
 if((b as Booking&{quoteJourneyId?:string}).quoteJourneyId)await readConsultPaymentBinding(db,tx,job,b as unknown as Record<string,unknown>);
 if(snapshot.choice==='full')return{version:2,totalPaise:job.totalAmount,advancePaymentId:null,advanceCapturedPaise:0,balanceDuePaise:job.totalAmount};
 if(!b.advancePaymentId||!b.advancePaidAt)throw new HttpsError('failed-precondition','The advance has not been verified. Do not collect again.');
 const p=(await tx.get(db.collection(COLLECTIONS.payments()).doc(b.advancePaymentId))).data()as Payment&{invoiceReviewNeeded?:boolean}|undefined;
 if(!p||p.id!==b.advancePaymentId||p.targetType!=='booking'||p.bookingId!==job.bookingId||p.customerId!==job.customerId||p.tenantId!==job.tenantId||p.studioId!==job.studioId||p.currency!==job.priceBreakdown.currency||p.amount!==snapshot.payNowPaise||p.status!=='completed'||p.method!=='razorpay_payment_link'||!p.razorpayPaymentId||p.invoiceReviewNeeded||p.refundAmount||p.externalReturnRecordId||p.overpayments?.length)throw new HttpsError('failed-precondition','Advance evidence needs office review. Do not collect twice.');
 const refunds=await tx.get(db.collection(COLLECTIONS.refundRequests()).where('paymentId','==',p.id).limit(20));
 if(refunds.size>=20||refunds.docs.some(d=>['reserved','submitting','submitted','accepted','ambiguous'].includes(d.data()['status'])))throw new HttpsError('failed-precondition','Advance refund review is open.');
 return{version:2,totalPaise:job.totalAmount,advancePaymentId:p.id,advanceCapturedPaise:p.amount,balanceDuePaise:job.totalAmount-p.amount};
}
export function assertCombinedSettlementPayment(job:ServiceJob,payment:Payment,basis:CombinedPaymentBasis|null){if(!basis)return;if(payment.tenantId!==job.tenantId||payment.studioId!==job.studioId||payment.customerId!==job.customerId||payment.bookingId!==job.bookingId||payment.jobId!==job.id||payment.amount!==basis.balanceDuePaise||!isDeepStrictEqual(payment.combinedBasis,basis))throw new HttpsError('failed-precondition','Payment balance changed. Office review required.');}

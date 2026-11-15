import type{Firestore,Transaction}from'firebase-admin/firestore';
import type{Invoice,ServiceJob,PriceBreakdown}from'@autodeck/core';
import{HttpsError}from'firebase-functions/v2/https';
import{readCoveredLink,exactCoveredInvoice}from'./membership-covered.js';
import{visitReturnHash}from'./visit-service-return-state.js';
export function coveredExtrasBreakdown(p:PriceBreakdown):PriceBreakdown{return{...p,basePrice:0,scopeAdjustment:0,subtotal:0,membershipDiscount:0,membershipDiscountPercent:null,addOns:[],pickupFee:0,dropFee:0,tax:0,total:0,...(p.roundOffPaise!==undefined?{roundOffPaise:0}:{})};}
/** The issued included-wash original stays zero and immutable. Only separately
 * customer-approved work is a new payable obligation on the same visit/job. */
export async function readVisitCoveredExtras(tx:Transaction,db:Firestore,job:ServiceJob,booking:Record<string,any>|undefined,invoice:Invoice|undefined){
 const fail=():never=>{throw new HttpsError('failed-precondition','Review the original included wash and approved extras.');};
 if(job.settlementKind!=='membership_covered'||job.additionalWorkDelta<=0)return null;
 if(!job.visitId||!booking||!invoice||job.priceBreakdown.total!==0||job.totalAmount!==job.additionalWorkDelta||job.priceBreakdown.tax!==0||job.priceBreakdown.taxRatePercent!==0||booking['totalAmount']!==0||booking['paymentStatus']!=='paid'||job.status==='CANCELLED'||job.priceBreakdown.pickupFee||job.priceBreakdown.dropFee)return fail();
 const originalJob={...job,totalAmount:0,additionalWorkDelta:0,paymentStatus:'paid' as const},linked=await readCoveredLink(db,tx,originalJob);
 if(!exactCoveredInvoice(invoice,originalJob,linked.booking,linked.membershipId))return fail();
 if((await tx.get(db.collection('memberships').doc(linked.membershipId).collection('visitCancellationRestores').doc(job.id))).exists)return fail();
 return{originalInvoiceId:invoice.id,originalInvoiceHash:visitReturnHash(invoice),membershipId:linked.membershipId};
}

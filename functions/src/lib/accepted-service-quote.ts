import{HttpsError}from'firebase-functions/v2/https';import type{QuoteJourney,PriceBreakdown,VehicleCategory}from'@autodeck/core';import{taxFor}from'./pricing.js';
export function acceptedServiceQuote(q:QuoteJourney|undefined,input:{tenantId:string;customerId:string;studioId:string;serviceId:string;vehicleId:string;revision:number;termsVersion:string}){
 if(!q||q.tenantId!==input.tenantId||q.customerId!==input.customerId||q.studioId!==input.studioId||q.scope.serviceId!==input.serviceId||q.scope.vehicleId!==input.vehicleId)throw new HttpsError('permission-denied','This quote does not match your service and car.');
 if(q.phase!=='accepted'||!q.offer||q.acceptedRevision!==q.offer.revision||q.offer.revision!==input.revision||q.offer.termsVersion!==input.termsVersion||q.bookingId)throw new HttpsError('failed-precondition','Accept the current quote before scheduling service.');
 if(!Number.isSafeInteger(q.offer.totalPaise)||q.offer.totalPaise<=0||!Number.isSafeInteger(q.offer.workingMinutes)||q.offer.workingMinutes<=0)throw new HttpsError('failed-precondition','Quote needs a studio review.');return q.offer;
}
/** Quoted total stays exact. Do not silently reinterpret a total as a before-tax amount. */
export function acceptedQuoteBreakdown(total:number,vehicleCategory:VehicleCategory,config:{taxRatePercent?:number;taxDescription?:string;currency:string}):PriceBreakdown{
 const tax=taxFor(config);if(!Number.isSafeInteger(total)||total<=0||!Number.isFinite(tax.taxRatePercent)||tax.taxRatePercent<0||tax.taxRatePercent>100)throw new HttpsError('failed-precondition','Quote tax needs a studio review.');
 const estimate=Math.round(total/(1+tax.taxRatePercent/100));let subtotal:number|null=null;for(let n=Math.max(0,estimate-2);n<=estimate+2;n++)if(n+Math.round(n*tax.taxRatePercent/100)===total){subtotal=n;break}if(subtotal===null)throw new HttpsError('failed-precondition','This exact quote total cannot be represented by the current tax rounding. Ask the studio to revise the quote by one paise.');const taxAmount=total-subtotal;
 return{vehicleCategory,basePrice:subtotal,scopeAdjustment:0,addOns:[],subtotal,membershipDiscount:null,membershipDiscountPercent:null,pickupFee:0,dropFee:0,taxRatePercent:tax.taxRatePercent,taxDescription:tax.taxDescription,tax:taxAmount,total,currency:config.currency};
}

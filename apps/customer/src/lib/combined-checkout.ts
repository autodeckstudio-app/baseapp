import{combinedBreakdown,combinedCheckoutAmounts,type PriceBreakdown,type CombinedPaymentChoice}from'@autodeck/core';
/** Candidate capability remains inactive. No old-native client silently opts into changed finances. */
export const COMBINED_CHECKOUT_ENABLED=false;
/** Independent qualification gate, not a live capability. */
export const COMBINED_GIFT_CHECKOUT_ENABLED=false;
export const COMBINED_WASH_CHECKOUT_ENABLED=false;
export const COMBINED_PICKUP_BENEFIT_ENABLED=false;
export const COMBINED_QUOTE_CHECKOUT_ENABLED=false;
export function combinedCheckoutReview(pb:PriceBreakdown,choice:CombinedPaymentChoice,transport?:{quoteId:string;kind:'pickup'|'drop'|'both';lat:number;lng:number;address:string;requestedPickupTime?:string;legs:readonly{leg:'pickup'|'drop';feePaise:number}[]},waiveTransport=false){let next=pb;if(transport){if(transport.address.trim().length<8)throw Error('Add the pickup address.');const expected=transport.kind==='both'?['pickup','drop']:[transport.kind];if(transport.legs.length!==expected.length||new Set(transport.legs.map(l=>l.leg)).size!==expected.length||transport.legs.some(l=>!expected.includes(l.leg)))throw Error('Recheck the selected transport quote.');next=combinedBreakdown(pb,waiveTransport?0:transport.legs.find(l=>l.leg==='pickup')?.feePaise??0,waiveTransport?0:transport.legs.find(l=>l.leg==='drop')?.feePaise??0)}const payment=combinedCheckoutAmounts(next.total,choice);return{breakdown:next,payment,review:{version:2 as const,paymentChoice:choice,expectedTotalPaise:payment.totalPaise,expectedPayNowPaise:payment.payNowPaise,...(transport?{transport:{quoteId:transport.quoteId,kind:transport.kind,lat:transport.lat,lng:transport.lng,address:transport.address.trim(),...(transport.requestedPickupTime?{requestedPickupTime:transport.requestedPickupTime}:{})}}:{})}}}

/** Preview matches server gift subtotal0, never gifts selected transport. Server alone validates the code/owner/state. */
export function giftCombinedServicePreview(pb:PriceBreakdown):PriceBreakdown{return{...pb,basePrice:0,scopeAdjustment:0,subtotal:0,tax:0,total:0,pickupFee:0,dropFee:0,membershipDiscount:null,membershipDiscountPercent:null}}

/** Main service only. Server verifies/consumes the exact selected wash atomically. */
export function washCombinedServicePreview(pb:PriceBreakdown):PriceBreakdown{return{...pb,membershipDiscount:pb.subtotal,membershipDiscountPercent:null,tax:0,total:0}}

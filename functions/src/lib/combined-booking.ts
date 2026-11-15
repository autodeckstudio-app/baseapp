import{combinedCheckoutAmounts,roundedCombinedCheckoutAmounts,roundedCombinedBreakdown,type PriceBreakdown}from'@autodeck/core';import{applyPickupFees}from'./pickup-fee.js';import{freezeBookingTransportQuote,type BookingTransportScope,type BookingTransportSnapshot}from'./booking-transport-snapshot.js';
/** Scoped combined checkout activation. Independent benefit/quote gates remain inactive. */
export function combinedCheckoutEnabled():boolean{return true}
/** Separate qualification gate. Gift service is covered, transport is not gifted. */
export function combinedGiftCheckoutEnabled():boolean{return false}
/** Service-wash qualification is separate from free transport reservation. */
export function combinedWashCheckoutEnabled():boolean{return false}
/** Private reservation qualification. Never enabled by the service-wash gate. */
export function combinedPickupBenefitEnabled():boolean{return false}
/** Exact accepted service-quote qualification, separately inactive. */
export function combinedQuoteCheckoutEnabled():boolean{return false}
export type CombinedPaymentChoice='advance20'|'full';
export type CombinedBookingReview={version:2|3;paymentChoice:CombinedPaymentChoice;expectedTotalPaise:number;expectedPayNowPaise:number;transport?:{quoteId:string;kind:'pickup'|'drop'|'both';lat:number;lng:number;address:string;requestedPickupTime?:string|undefined}|undefined};
export const combinedPaymentAmounts=combinedCheckoutAmounts;
/** Called with transaction-read quote. No client money becomes authoritative. */
export function reviewCombinedBooking(pb:PriceBreakdown,review:CombinedBookingReview,quote:unknown,scope:Omit<BookingTransportScope,'kind'|'quoteId'|'lat'|'lng'>,waiveTransport=false){let transport:Readonly<BookingTransportSnapshot>|null=null;let breakdown=pb;if(review.transport){const t=review.transport;transport=freezeBookingTransportQuote(quote,{...scope,quoteId:t.quoteId,kind:t.kind,lat:t.lat,lng:t.lng});breakdown=applyPickupFees(pb,waiveTransport?0:transport.pickupFeePaise,waiveTransport?0:transport.dropFeePaise)}if(review.version===3)breakdown=roundedCombinedBreakdown(breakdown);const amounts=review.version===3?roundedCombinedCheckoutAmounts(breakdown.total,review.paymentChoice):combinedPaymentAmounts(breakdown.total,review.paymentChoice);if(amounts.totalPaise>0&&amounts.payNowPaise===0)throw Error('The rounded advance is zero. Choose full payment.');if(amounts.totalPaise!==review.expectedTotalPaise||amounts.payNowPaise!==review.expectedPayNowPaise)throw Error('The reviewed amount changed. Review the price again before paying.');return{breakdown,transport,payment:amounts}}
/** Preserve exact payload identity on retry, including logistics and reviewed payment choice. */
export function combinedReviewIdentity(review:CombinedBookingReview|undefined):string|null{return review?JSON.stringify([review.version,review.paymentChoice,review.expectedTotalPaise,review.expectedPayNowPaise,review.transport?[review.transport.quoteId,review.transport.kind,review.transport.lat,review.transport.lng,review.transport.address,review.transport.requestedPickupTime??null]:null]):null}

import type {PriceBreakdown} from '@autodeck/core';
import {applyPickupFees} from './pickup-fee.js';
/** PRIVATE review math only. Not imported by a callable or adopted as money policy.
 * Proposal: remove only unused original legs, keep already-captured funding,
 * return only overpayment through a separate approved original-method review.
 * Never rewrites the immutable combined-payment or transport snapshots.
 */
export function previewUnusedTransportAdjustment(input:{breakdown:PriceBreakdown;paidPaise:number;removePickup:boolean;removeDrop:boolean;pickupUsed:boolean;dropUsed:boolean}){
 const {breakdown:b,paidPaise}=input;
 for(const n of [b.pickupFee,b.dropFee,b.subtotal,b.total,b.tax,paidPaise])if(!Number.isSafeInteger(n)||n<0)throw Error('Money evidence needs review.');
 if(paidPaise>b.total)throw Error('Existing overpayment needs separate review.');
 if(!input.removePickup&&!input.removeDrop)throw Error('Choose an unused leg for review.');
 if(input.removePickup&&(input.pickupUsed))throw Error('Pickup has already been used.');
 if(input.removeDrop&&(input.dropUsed))throw Error('Drop has already been used.');
 const checked=applyPickupFees(b,b.pickupFee,b.dropFee);
 if(checked.total!==b.total||checked.tax!==b.tax)throw Error('Original price and tax do not reconcile.');
 const proposed=applyPickupFees(b,input.removePickup?0:b.pickupFee,input.removeDrop?0:b.dropFee);
 if(proposed.total<0||proposed.total>b.total)throw Error('Adjusted price needs review.');
 return{status:'proposal_only' as const,originalTotalPaise:b.total,proposedBreakdown:proposed,reductionPaise:b.total-proposed.total,existingPaidPaise:paidPaise,balancePaise:Math.max(0,proposed.total-paidPaise),overpaymentReviewPaise:Math.max(0,paidPaise-proposed.total),additionalDepositPaise:0,needsSeparateReturnApproval:paidPaise>proposed.total};
}

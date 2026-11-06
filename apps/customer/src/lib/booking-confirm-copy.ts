/** Describe the effective route; never imply a settled payment or a price-change permission. */
export function bookingConfirmCopy({quote,gift,membership,online,advance}:{quote:boolean;gift:boolean;membership:boolean;online:boolean;advance:boolean}):string{
 if(quote)return 'Review the proposed work and price before approving a quote. A quote request does not approve work.';
 if(gift)return 'Confirm your slot. Your gift covers the selected wash.';
 if(membership)return 'Confirm your slot using the selected membership wash.';
 if(online)return 'Continue to secure payment to confirm this visit. Review the total above before paying.';
 if(advance)return 'Pay the displayed advance online to confirm. The remaining amount is due at the studio.';
 return 'Confirm this visit and pay at the studio. Review the total above before confirming.';
}

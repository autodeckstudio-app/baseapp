import scope from './catalogue-starting-prices.json';
type Row={customerMenu?:{priceMode:string;priceNote:string;priceCondition:string};id?:string;category?:string;basePrice:number;active?:boolean;currency?:string};
// Display-only scope from the reviewed 12 Nov 58+4 price PDF. Never used for
// booking calculations, quote eligibility on the server, or financial snapshots.
const reviewed=scope as Record<string,{category:string;basePrice:number}>;
export function reviewedQuoteRequired(s:{id?:string}):boolean{return !!s.id&&reviewed[s.id]?.category==='tinting'}
export function reviewedStartingPrice(s:Row):{label:string;note:string;condition:string}|null{
 if(s.customerMenu){if(s.active===false||s.customerMenu.priceMode!=='from')return null;return {label:'From ₹'+(s.basePrice/100).toLocaleString('en-IN',{maximumFractionDigits:2}),note:s.customerMenu.priceNote,condition:s.customerMenu.priceCondition};}
 const match=s.id?reviewed[s.id]:undefined;
 if(!match||s.active===false||s.category!==match.category||s.basePrice!==match.basePrice||s.currency&&s.currency!=='INR')return null;
 return{label:'From ₹'+(s.basePrice/100).toLocaleString('en-IN',{maximumFractionDigits:2}),condition:match.category==='tinting'?'SUV / larger: +₹1,000-₹2,000, quoted':'Paint correction: extra, by condition',note:match.category==='tinting'?'Starting film price. SUV and larger vehicles are quoted ₹1,000-₹2,000 higher. The studio confirms the fit and final price before you approve.':'Starting treatment price. Paint correction is billed separately based on condition. The studio confirms the final price before you approve.'};
}

export function alignedCustomerPriceLabel(s:Row & {priceOnRequest?:boolean;priceFrom?:boolean}):string{return reviewedStartingPrice(s)?.label??(s.priceOnRequest?'Quote on request':`${s.priceFrom?'From ':''}₹${(s.basePrice/100).toLocaleString('en-IN',{maximumFractionDigits:2})}`);}

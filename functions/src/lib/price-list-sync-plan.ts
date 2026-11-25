import {createHash} from 'node:crypto';

/** LOCAL PREPARATION ONLY. No I/O, runtime export, grant, trigger or activation.
 * Google Sheets does not offer cell CAS. A checked plan is not a safe write lease.
 */
export const PRICE_LIST_ID='15K6LY_sbDF_6UNEqg1rycqxnuyd5lvPCH7pk17deol0';
const columns:Record<string,string>={Ceramic:'I',PPF:'L',Detailing:'J',Washing:'F',Garage:'D',PPS:'I'};
export interface PriceBinding{serviceId:string;tab:string;row:number;column:string;identityHash:string;policy:'fixed'|'inspection';}
export interface AcceptedPrice{bindingHash:string;minor:number;publicationId:string;}
export interface ObservedPrice{serviceId:string;identityHash:string;sheetValue:unknown;sheetFormula:string|null;adminMinor:number;sourceVersion:string;hasOtherDraft:boolean;}
export interface PriceChange{serviceId:string;kind:'sheet-draft'|'sheet-return';beforeMinor:number;afterMinor:number;bindingHash:string;identityHash:string;sourceVersion:string;publicationId:string;range:string;}
export type PriceDecision={kind:'same'|'inspection';serviceId:string}|{kind:'change';change:PriceChange}|{kind:'blocked';serviceId:string;reason:string};
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)).digest('hex');
const minor=(n:unknown):number=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1_000_000)throw Error('Finite nonnegative numeric selling price required');const cents=Math.round(n*100);if(Math.abs(n*100-cents)>0.00001||!Number.isSafeInteger(cents))throw Error('Whole paise required');return cents;};
export function bindingHash(b:PriceBinding){return digest([PRICE_LIST_ID,b.serviceId,b.tab,b.row,b.column,b.identityHash,b.policy]);}
export function validatePriceBinding(b:PriceBinding){if(!/^[A-Za-z0-9_-]{1,128}$/.test(b.serviceId)||!Number.isInteger(b.row)||b.row<(b.tab==='PPS'?2:3)||b.row>1000||!b.identityHash)throw Error('Exact identity binding required');if(b.policy==='fixed'&&columns[b.tab]!==b.column)throw Error('Selling-price cell required');if(b.policy!=='fixed'&&b.policy!=='inspection')throw Error('Known price policy required');}
/** Call only after a trusted initial reconciliation. A mismatch is NOT an import.
 * Inspection-only amounts are not price inputs; duplicate/roll variants need an
 * explicit one-customer-price binding before acceptance.
 */
export function acceptInitialPrice(b:PriceBinding,o:ObservedPrice,publicationId:string):AcceptedPrice{
 validatePriceBinding(b);if(b.policy!=='fixed'||!publicationId||o.serviceId!==b.serviceId||o.identityHash!==b.identityHash||o.sheetFormula||o.hasOtherDraft||minor(o.sheetValue)!==o.adminMinor)throw Error('Initial source and published price reconciliation required');return{bindingHash:bindingHash(b),minor:o.adminMinor,publicationId};
}
/** Three-way reconciliation. Neither the current sheet nor Admin automatically
 * wins when both changed. Sheet input creates a draft, never a publication.
 * Admin->sheet effects are only plans, gated by an explicit frozen publish.
 */
export function planPrice(b:PriceBinding,base:AcceptedPrice,o:ObservedPrice):PriceDecision{
 try{validatePriceBinding(b);if(o.serviceId!==b.serviceId||o.identityHash!==b.identityHash||base.bindingHash!==bindingHash(b))throw Error('Row identity or binding changed');if(b.policy==='inspection')return{kind:'inspection',serviceId:b.serviceId};if(o.sheetFormula)throw Error('Formula price cell cannot be overwritten');if(o.hasOtherDraft)throw Error('Existing shared draft must be resolved first');if(!Number.isSafeInteger(base.minor)||base.minor<0||!Number.isSafeInteger(o.adminMinor)||o.adminMinor<0||!base.publicationId||!o.sourceVersion)throw Error('Trusted accepted version required');const sheet=minor(o.sheetValue),admin=o.adminMinor;if(sheet===admin)return{kind:'same',serviceId:b.serviceId};if(sheet!==base.minor&&admin!==base.minor)throw Error('Concurrent sheet and Admin price changes');const fromSheet=sheet!==base.minor;return{kind:'change',change:{serviceId:b.serviceId,kind:fromSheet?'sheet-draft':'sheet-return',beforeMinor:fromSheet?admin:sheet,afterMinor:fromSheet?sheet:admin,bindingHash:base.bindingHash,identityHash:b.identityHash,sourceVersion:o.sourceVersion,publicationId:base.publicationId,range:`'${b.tab}'!${b.column}${b.row}`}};}catch(e){return{kind:'blocked',serviceId:b.serviceId,reason:e instanceof Error?e.message:'Invalid price state'};}
}
export function pricePlanHash(changes:PriceChange[]){if(!changes.length||changes.length>120||new Set(changes.map(x=>x.serviceId)).size!==changes.length||new Set(changes.map(x=>x.range)).size!==changes.length)throw Error('Bounded unique price plan required');return digest(changes);}
/** A single shared draft ID and exact version/source preimage must be frozen
 * by the server's review operation. This checks no Google access or authority.
 */
export function assertFrozenPricePlan(changes:PriceChange[],review:{hash:string;drafts:{serviceId:string;draftId:string;version:number;sourceVersion:string}[]}){
 if(pricePlanHash(changes)!==review.hash||review.drafts.length!==changes.length||new Set(review.drafts.map(x=>x.draftId)).size!==changes.length)throw Error('Frozen price review mismatch');for(const change of changes){const rows=review.drafts.filter(x=>x.serviceId===change.serviceId);if(rows.length!==1||!rows[0]!.draftId||!Number.isSafeInteger(rows[0]!.version)||rows[0]!.version<1||rows[0]!.sourceVersion!==change.sourceVersion)throw Error('Exact shared draft review required');}
}

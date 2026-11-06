import ranges from './brand-enquiries.json';
import type{QuoteReference}from'./quote-journey';
/** Reference descriptions only, never stock, price or booking authority. */
export const REFERENCE_RANGES=ranges as (QuoteReference&{note:string;source?:string;surface?:string})[];

export function referenceServiceFamily(r:{group:string;surface?:string}):'ppf'|'ceramic'|'coating'{return r.group==='ppf'?'ppf':r.surface&&['fabric','glass','leather','maintenance-coating','sealant','trim','wheel','ppf-coat'].includes(r.surface)?'coating':'ceramic'}

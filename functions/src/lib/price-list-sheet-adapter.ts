import{bindingHash,validatePriceBinding,type PriceBinding,type PriceChange}from'./price-list-sync-plan.js';
/** Isolated, unconnected local source-price adapter. It never writes headings,
 * cost, profit, formulas, descriptions, blank targets, new rows or inspection
 * figures. Transport/auth/runtime composition is deliberately NOT installed.
 * Sheets has NO compare-and-swap. The controller must hold the reviewed no-edit
 * publish window; re-reading alone cannot exclude a simultaneous human edit.
 */
export interface PriceCellSnapshot{identityHash:string;value:unknown;formula:string|null;}
export interface PriceListPort{read:(bindings:PriceBinding[])=>Promise<PriceCellSnapshot[]>;writeNumericCells:(cells:{range:string;value:number}[])=>Promise<void>;}
export interface SourcePriceReview{operationId:string;exclusiveWindowId:string;changes:PriceChange[];}
export interface SourcePriceReceipt{operationId:string;state:'already-verified'|'verified';serviceIds:string[];}
function equalValue(cell:PriceCellSnapshot,expectedMinor:number){return cell.formula===null&&typeof cell.value==='number'&&Number.isFinite(cell.value)&&Math.abs(cell.value*100-expectedMinor)<0.00001;}
/** This runs only after server authentication/authority, exact plan-hash review
 * and durable operation reservation. It is not itself an authorization API.
 * Unknown/partial writes throw and require read-only recovery, never blind retry
 * or rollback over a user's intervening edit.
 */
export async function applySourcePriceReview(bindings:PriceBinding[],review:SourcePriceReview,port:PriceListPort):Promise<SourcePriceReceipt>{
 if(!review.operationId||!review.exclusiveWindowId||!review.changes.length||review.changes.length>120||new Set(review.changes.map(c=>c.serviceId)).size!==review.changes.length)throw Error('Reserved exact source-price operation required');
 const selected=review.changes.map(c=>{const matches=bindings.filter(b=>b.serviceId===c.serviceId);if(matches.length!==1)throw Error('Unique source binding required');const b=matches[0]!;validatePriceBinding(b);if(b.policy!=='fixed'||bindingHash(b)!==c.bindingHash||b.identityHash!==c.identityHash||`'${b.tab}'!${b.column}${b.row}`!==c.range||c.kind!=='sheet-return'||!Number.isSafeInteger(c.beforeMinor)||!Number.isSafeInteger(c.afterMinor)||c.beforeMinor<0||c.afterMinor<0)throw Error('Frozen selling-price return required');return b;});
 if(new Set(review.changes.map(c=>c.range)).size!==selected.length)throw Error('Unique destination cells required');
 const before=await port.read(selected);if(before.length!==selected.length||before.some((x,i)=>x.identityHash!==selected[i]!.identityHash))throw Error('Price-row identity changed');
 if(before.every((x,i)=>equalValue(x,review.changes[i]!.afterMinor)))return{operationId:review.operationId,state:'already-verified',serviceIds:selected.map(b=>b.serviceId)};
 if(before.some((x,i)=>!equalValue(x,review.changes[i]!.beforeMinor)))throw Error('Source price changed or prior partial write; recovery required');
 // One last check under the caller's no-edit window, not a claim of atomic CAS.
 const checked=await port.read(selected);if(JSON.stringify(checked)!==JSON.stringify(before))throw Error('Source changed before write');
 await port.writeNumericCells(review.changes.map(c=>({range:c.range,value:c.afterMinor/100})));
 const after=await port.read(selected);if(after.length!==selected.length||after.some((x,i)=>x.identityHash!==selected[i]!.identityHash||!equalValue(x,review.changes[i]!.afterMinor)))throw Error('Source-price write not verified; recovery required');
 return{operationId:review.operationId,state:'verified',serviceIds:selected.map(b=>b.serviceId)};
}

import{createHash}from'node:crypto';
import type{Firestore}from'firebase-admin/firestore';
import{cataloguePanelStore,type PanelSave,type PanelView}from'./catalogue-panel-store.js';
import{catalogueReviewHash}from'./catalogue-draft.js';
import{pricePlanHash,type PriceChange}from'./price-list-sync-plan.js';
/** LOCAL PREPARATION ONLY. Explicit import stages shared drafts, never prices,
 * source cells or snapshots. Not exported by any production entrypoint.
 */
export interface PriceImportPort{read:(id:string)=>Promise<PanelView>;prior:(input:PanelSave)=>Promise<PanelView|null>;save:(input:PanelSave)=>Promise<PanelView>;}
export interface PriceImportRequest{operationId:string;planHash:string;changes:PriceChange[];}
export interface PriceImportResult{state:'staged'|'needs-recovery';operationId:string;completed:{serviceId:string;operationId:string;view:PanelView}[];unconfirmed?:{serviceId:string;operationId:string};}
function itemId(request:PriceImportRequest,c:PriceChange){return'price_import_'+createHash('sha256').update(JSON.stringify([request.operationId,request.planHash,c.serviceId])).digest('hex').slice(0,40);}
/** Exact same input/operation survives an unknown response. Completed receipts
 * are validated before reuse. An absent receipt is read-only here, never ended
 * through the panel status API (which intentionally tombstones an absent op).
 * A multi-service import is not atomic; its per-item receipts make partial
 * completion explicit and recoverable without recreating earlier drafts.
 */
export async function stageSheetPriceImport(request:PriceImportRequest,port:PriceImportPort):Promise<PriceImportResult>{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(request.operationId)||request.planHash!==pricePlanHash(request.changes)||request.changes.some(c=>c.kind!=='sheet-draft'||!Number.isSafeInteger(c.beforeMinor)||!Number.isSafeInteger(c.afterMinor)||c.beforeMinor<0||c.afterMinor<0||c.afterMinor>100_000_000||!c.sourceVersion||!c.bindingHash||!c.identityHash))throw Error('Exact sheet draft plan required');
 const prepared=await Promise.all(request.changes.map(async c=>{const input:PanelSave={serviceId:c.serviceId,draftId:null,version:0,sourceVersion:c.sourceVersion,basePrice:c.afterMinor,operationId:itemId(request,c)};const prior=await port.prior(input);if(prior)return{c,input,prior};const live=await port.read(c.serviceId);if(!live.editable||live.draftId!==null||live.version!==0||live.sourceVersion!==c.sourceVersion||live.basePrice!==c.beforeMinor)throw Error('Shared draft or live source changed before import');return{c,input,prior:null};}));
 const completed:PriceImportResult['completed']=[];
 for(const item of prepared){try{const view=item.prior??await port.save(item.input);if(view.serviceId!==item.c.serviceId||view.basePrice!==item.c.afterMinor||view.sourceVersion!==item.c.sourceVersion||!view.draftId||view.version<1)throw Error('Exact shared draft receipt required');completed.push({serviceId:item.c.serviceId,operationId:item.input.operationId,view});}catch{return{state:'needs-recovery',operationId:request.operationId,completed,unconfirmed:{serviceId:item.c.serviceId,operationId:item.input.operationId}};}}
 return{state:'staged',operationId:request.operationId,completed};
}
/** Read-only recovery of an exact import, even after preview expiry. */
export async function inspectSheetPriceImport(request:PriceImportRequest,port:PriceImportPort):Promise<PriceImportResult>{if(request.planHash!==pricePlanHash(request.changes))throw Error('Exact frozen import required');const completed:PriceImportResult['completed']=[];let unconfirmed:PriceImportResult['unconfirmed'];for(const c of request.changes){const operationId=itemId(request,c),view=await port.prior({serviceId:c.serviceId,draftId:null,version:0,sourceVersion:c.sourceVersion,basePrice:c.afterMinor,operationId});if(view)completed.push({serviceId:c.serviceId,operationId,view});else unconfirmed??={serviceId:c.serviceId,operationId};}return{state:unconfirmed?'needs-recovery':'staged',operationId:request.operationId,completed,...(unconfirmed?{unconfirmed}:{})};}
/** Caller must pass a reviewed server-owned mapping's IDs, never a client list.
 * This adapter intentionally refuses to overwrite ANY existing draft during an
 * import. Normal sidebar/Admin edits can still edit their exact shared version.
 */
export function priceListImportStore(db:Firestore,actor:{uid:string;tenantId:string;role:string},reviewedAllowedIds:readonly string[]):PriceImportPort{
 const panel=cataloguePanelStore(db,actor,reviewedAllowedIds,{allowZeroPrice:true});
 return{read:panel.read,save:panel.save,async prior(input){if(!reviewedAllowedIds.includes(input.serviceId))throw Error('Mapped service required');const row=(await db.collection('cataloguePanelOperations').doc(input.operationId).get()).data();if(!row)return null;if(row['cancelled']||row['actor']!==actor.uid||row['tenantId']!==actor.tenantId||row['digest']!==catalogueReviewHash({input}))throw Error('Import operation identity mismatch');const saved=row['view']as PanelView,current=await panel.read(input.serviceId);if(!current.editable||current.draftId!==saved.draftId||current.version!==saved.version||current.basePrice!==saved.basePrice||current.sourceVersion!==saved.sourceVersion)throw Error('Prior import is no longer the current shared draft');return current;}};
}

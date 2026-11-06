/** Client status never proves either destination changed. Only a fresh server
 * receipt may complete this operation. Persist the operation ID before sending.
 * Transport failures are unknown, not permission for another publish attempt.
 */
export type CataloguePublishState={operationId:string|null;phase:'idle'|'submitting'|'unknown'|'recovery'|'complete';message:string;canPublish:boolean;canInspect:boolean};
export const initialCataloguePublishState:CataloguePublishState={operationId:null,phase:'idle',message:'Review only. Publishing is unavailable until the secure runtime and App Check are ready.',canPublish:false,canInspect:false};
export type CataloguePublishEvent={type:'begin';operationId:string;runtimeReady:boolean;appCheckReady:boolean;reviewFrozen:boolean}|{type:'transport-failed';operationId:string}|{type:'server-status';operationId:string;phase:'reserved'|'sheet-write-in-flight'|'sheet-verified'|'needs-recovery-readback'|'complete'}|{type:'inspection-failed';operationId:string};
export function cataloguePublishState(state:CataloguePublishState,event:CataloguePublishEvent):CataloguePublishState{
 if(event.type==='begin'){if(state.phase!=='idle'||!event.runtimeReady||!event.appCheckReady||!event.reviewFrozen||!/^[A-Za-z0-9_-]{1,128}$/.test(event.operationId))return state;return{operationId:event.operationId,phase:'submitting',message:'Checking the reviewed publish. Do not start another publish.',canPublish:false,canInspect:true};}
 if(!state.operationId||state.operationId!==event.operationId)return state;
 if(state.phase==='complete')return state;
 if(event.type==='transport-failed'||event.type==='inspection-failed')return{...state,phase:'unknown',message:'The result is unknown. Check this operation status before doing anything else. Do not retry or overwrite either destination.',canPublish:false,canInspect:true};
 if(event.phase==='complete')return{...state,phase:'complete',message:'The server confirmed this publish completed.',canPublish:false,canInspect:false};
 if(event.phase==='needs-recovery-readback')return{...state,phase:'recovery',message:'A fresh read-back and explicit recovery review are required. Do not retry this publish.',canPublish:false,canInspect:true};
 return{...state,phase:'unknown',message:'The server has not confirmed completion. Check this same operation status. Do not start a second publish.',canPublish:false,canInspect:true};
}

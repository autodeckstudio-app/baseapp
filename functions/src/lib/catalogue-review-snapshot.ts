import{publicRowHash,publicDestinationForCategory}from'./catalogue-public-sheet.js';
import type{Firestore}from'firebase-admin/firestore';import{reviewCatalogueDraft,type CatalogueDraft}from'./catalogue-draft.js';
/** INTERNAL ONLY. Fixed-book worker supplies the row read, never a client hash.
 * A read outside the transaction is safe only because publishing rechecks its
 * frozen preimage before effect. No Sheets transaction/CAS guarantee is implied.
 * AppCheck/caller role/tenant/rate limit/authenticated worker port remain required.
 */
export async function reviewCatalogueWithPublicSnapshot(db:Firestore,input:{draftId:string;tenantId:string;actor:string;role:string;expectedVersion:number},sheet:{read:(serviceId:string)=>Promise<{hash:string;cells:unknown[];serviceId?:string}>;inspectNewRow?:(serviceId:string,destination:string)=>Promise<{serviceId?:string;destination?:string;expectedTabHash:string}>;inspectExistingRow?:(serviceId:string)=>Promise<{serviceId:string;present:true;rowHash:string;cells:string[]}|{serviceId:string;present:false}>}){
 if(!['admin','superadmin'].includes(input.role)||input.tenantId!=='automodz')throw Error('Managed catalogue review denied');
 const ref=db.collection('catalogueDrafts').doc(input.draftId),initial=(await ref.get()).data()as CatalogueDraft|undefined;
 if(!initial||initial.tenantId!==input.tenantId||!initial.serviceId||initial.version!==input.expectedVersion||initial.state!=='draft')throw Error('Exact draft unavailable');
 let publicRowHash_:string|null=null,missingRowTabHash:string|null=null,missingRowDestination:string|null=null;
 // Wire-typed presence check: the worker returns a validated present/absent verdict from its full 7-tab scan. An absent verdict is the ONLY trigger for the append path; transport, auth, topology, duplicate or malformed-row failures still throw and fail closed.
 if(!sheet.inspectExistingRow)throw Error('Existing-row inspection unavailable');
 const probe=await sheet.inspectExistingRow(initial.serviceId);
 if(probe.serviceId!==initial.serviceId)throw Error('Exact public snapshot unavailable');
 if(probe.present){if(probe.cells.length!==5||probe.cells[0]!==initial.serviceId||probe.rowHash!==publicRowHash(probe.cells))throw Error('Exact public snapshot unavailable');publicRowHash_=probe.rowHash;}
 else{
  const destination=publicDestinationForCategory(initial.payload?.category);
  if(!destination)throw Error('Public service row missing and category has no fixed destination');
  if(!sheet.inspectNewRow)throw Error('New-row inspection unavailable');
  const plan=await sheet.inspectNewRow(initial.serviceId,destination);
  if(plan.serviceId!==initial.serviceId||plan.destination!==destination||!/^[a-f0-9]{64}$/.test(plan.expectedTabHash))throw Error('Exact new-row snapshot required');
  missingRowTabHash=plan.expectedTabHash;missingRowDestination=destination;
 }
 return db.runTransaction(async tx=>{const snap=await tx.get(ref),draft=snap.data()as CatalogueDraft|undefined;if(!draft||draft.tenantId!==input.tenantId||draft.serviceId!==initial.serviceId||draft.version!==initial.version)throw Error('Draft changed during snapshot');const source=await tx.get(db.collection('services').doc(draft.serviceId!));if(!source.exists||source.data()!['tenantId']!==input.tenantId)throw Error('Service unavailable');const now=new Date().toISOString(),base=missingRowTabHash?{...draft,publicDestination:missingRowDestination as CatalogueDraft['publicDestination']}:draft,reviewed=reviewCatalogueDraft(base,{actor:input.actor,role:input.role,now,expectedVersion:input.expectedVersion,currentServiceUpdatedAt:source.data()!['updatedAt'],trustedPublicRowHash:publicRowHash_,trustedNewRow:missingRowTabHash?{serviceId:draft.serviceId!,tabHash:missingRowTabHash}:null,trustedMissingRow:missingRowTabHash!==null});tx.set(ref,reviewed);tx.set(db.collection('auditLog').doc(),{tenantId:input.tenantId,action:'service.catalogue_snapshot_reviewed',entityType:'CatalogueDraft',entityId:ref.id,performedBy:input.actor,performedByRole:input.role,createdAt:now,metadata:{version:reviewed.version,reviewHash:reviewed.reviewHash,missingPublicRow:missingRowTabHash!==null}});return reviewed;});
}

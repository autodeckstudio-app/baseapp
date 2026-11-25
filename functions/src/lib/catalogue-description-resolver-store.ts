import{createHash}from'node:crypto';import type{Firestore,Transaction}from'firebase-admin/firestore';
const ids=new Set(['svc-wash-regular','menu-coat-glass','svc-brand-kovalent-fabric','svc-ppf-garware-plus']);
const stable=(x:any):any=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function fail(m:string):never{throw Error(m)}
/** Controller-only durable lookup. No caller chooses actor, service, plan,
 * money, coordinates or database path. No source/physical effect occurs here.
 * Must be supplied only to the authenticated private resolver factory. */
export function descriptionResolverStore(db:Firestore){
 async function state(tx:Transaction,operationId:string,inspection:boolean){
  const ref=db.collection('catalogueNativeDescriptionOperations').doc(operationId),op=(await tx.get(ref)).data();
  if(!op||op['id']!==operationId||op['tenantId']!=='automodz'||typeof op['actor']!=='string'||!op['actor'])fail('Known saved description operation required');
  const p=op['plan'];if(!p||p.kind!=='native-description-update-v1'||p.operationId!==operationId||!ids.has(p.serviceId))fail('Exact four-description source scope required');
  const{reviewHash,...body}=p;if(hash(body)!==reviewHash||op['ticketHash']!==reviewHash)fail('Frozen source plan required');
  if(inspection){if(!['source-in-flight','source-verified','projection-in-flight','needs-recovery','complete'].includes(op['phase']))fail('Known description inspection required');return{ref,op,p}}
  const source=(await tx.get(db.collection('catalogueSourceAccessLocks').doc('automodz'))).data(),publish=(await tx.get(db.collection('cataloguePublishLocks').doc('automodz'))).data(),registry=(await tx.get(db.collection('catalogueSourceRegistries').doc('automodz'))).data(),draft=(await tx.get(db.collection('catalogueDrafts').doc(p.canonicalReview.draftId))).data(),service=(await tx.get(db.collection('services').doc(p.serviceId))).data();
  if(op['phase']!=='source-in-flight'||op['sourceAttemptClaimed']!==true||op['sourceTransportAttemptClaimed']===true||source?.['kind']!=='description'||source?.['activeOperationId']!==operationId||publish?.['activePublishId']!==operationId||hash(registry??null)!==p.beforeRegistryHash||hash(service??null)!==p.beforeServiceHash||draft?.['state']!=='publishing'||draft?.['serviceId']!==p.serviceId||draft?.['reviewHash']!==p.canonicalReview.reviewHash||hash({...draft,state:'reviewed'})!==op['draftHash'])fail('Fresh exact source reservation and preimages required');
  const records=await Promise.all(p.priceBaselines.map((b:{serviceId:string})=>tx.get(db.collection('catalogueSourcePriceBaselines').doc(b.serviceId))));
  if(records.some((r:{data:()=>unknown},i:number)=>hash(r.data()??null)!==p.priceBaselines[i].documentHash))fail('Accepted price baseline changed');
  const runtime=(await tx.get(db.collection('catalogueSourceRuntimeGates').doc('automodz'))).data();if(runtime?.['state']!=='ready'||runtime?.['mappingVersion']!==registry?.['version']||runtime?.['activeOperationId']!==operationId||runtime?.['oldHandlersQuiesced']!==true)fail('Verified shared runtime maintenance gate required');
  const authority=op['sourceAuthority'];if(authority?.scope!=='native-description-lifecycle-v1'||authority.operationId!==operationId||authority.sourceReviewHash!==reviewHash||authority.canonicalReviewHash!==p.canonicalReview.reviewHash||authority.noSheetEdits!==true||authority.allWritersQuiesced!==true)fail('Saved description execution authority required');
  return{ref,op,p,authority};
 }
 return{resolveInspection:(id:string)=>db.runTransaction(async tx=>{const s=await state(tx,id,true);return{plan:s.p,readOnly:true}}),resolveAttempt:(id:string)=>db.runTransaction(async tx=>{const s=await state(tx,id,false);return{plan:s.p,authority:{...s.authority,state:'source-in-flight',registryHash:s.p.beforeRegistryHash}}}),claimAttempt:(id:string)=>db.runTransaction(async tx=>{const s=await state(tx,id,false);tx.update(s.ref,{sourceTransportAttemptClaimed:true});return{claimed:true,reviewHash:s.p.reviewHash}})};
}

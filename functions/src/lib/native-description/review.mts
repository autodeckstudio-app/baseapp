import{z}from'zod';
import{catalogueController}from'../catalogue-controller.js';
import{cataloguePayloadSchema,catalogueReviewHash}from'../catalogue-draft.js';
import{prepareNativeDescriptionUpdate}from'./source-plan.mjs';
import{hash}from'./fingerprint.mjs';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),input=z.object({draftId:id,expectedVersion:z.number().int().positive()}).strict();
const approvedIds=new Set(['svc-wash-regular','menu-coat-glass','svc-brand-kovalent-fabric','svc-ppf-garware-plus']);
const fail=(message:string):never=>{throw Error(message)};
/** NEW bounded caller integration. Runs the real canonical existing-service
 * review, then prepares one server-owned original-source description plan.
 * Mandatory qualified-runtime port. Deliberately NO publish, write, unlock or recovery
 * commit route until a durable cross-system lifecycle is separately qualified.
 */
export function nativeDescriptionReview(db:any,sheet:any,actor:any,config:{readSnapshot:()=>Promise<any>;assertQualifiedRuntime:()=>Promise<void>}){
 if(typeof config.assertQualifiedRuntime!=='function')fail('Qualified native description runtime required');
 const authorize=()=>{if(!actor?.appCheckVerified||actor.tenantId!=='automodz'||!actor.uid||!['admin','superadmin'].includes(actor.role))fail('Verified description admin required')};
 const actual=catalogueController(db,sheet,actor),tickets=db.collection('catalogueNativeDescriptionReviews');
 function draftHash(d:any){const body={id:d.id,tenantId:d.tenantId,serviceId:d.serviceId,expectedServiceUpdatedAt:d.expectedServiceUpdatedAt,version:d.version,payload:d.payload,expectedPublicRowHash:d.expectedPublicRowHash??null,publicDestination:d.publicDestination??null,newServiceId:d.newServiceId??null,expectedNewTabHash:d.expectedNewTabHash??null};return catalogueReviewHash(body)}
 async function state(draftId:string,version:number,allowed:string[]){
  const d=(await db.collection('catalogueDrafts').doc(draftId).get()).data(),r=(await db.collection('catalogueSourceRegistries').doc(actor.tenantId).get()).data(),lock=(await db.collection('catalogueSourceAccessLocks').doc(actor.tenantId).get()).data(),publication=(await db.collection('cataloguePublishLocks').doc(actor.tenantId).get()).data();
  if(lock?.activeOperationId||publication?.activePublishId||publication?.activeSharedOperationId)fail('Catalogue source or publication is active');
  if(!d||d.id!==draftId||d.tenantId!==actor.tenantId||!d.serviceId||d.version!==version||!allowed.includes(d.state))fail('Exact existing description draft required');
  if(!approvedIds.has(d.serviceId))fail('Only the four approved description services are available');const before=(await db.collection('services').doc(d.serviceId).get()).data();if(before?.category==='garage'||before?.customerMenu?.home==='garage')fail('Garage description scope is settled');if(!before||before.tenantId!==actor.tenantId||before.updatedAt!==d.expectedServiceUpdatedAt)fail('Canonical service preimage changed');
  const payload=cataloguePayloadSchema.parse(d.payload),canonical:any={};for(const k of Object.keys(cataloguePayloadSchema.shape))if(before[k]!==undefined)canonical[k]=before[k];
  const normalized:any=cataloguePayloadSchema.parse(canonical),without=(x:any)=>{const copy={...x};delete copy.description;return copy};
  if(hash(without(payload))!==hash(without(normalized)))fail('Only description may change in this route');
  if(d.state==='reviewed'&&d.reviewHash!==draftHash(d))fail('Frozen canonical review changed');
  if(!r?.bindings?.length||r.bindings.length>120)fail('Current accepted source registry required');
  const baselines=await db.getAll(...r.bindings.filter((b:any)=>b.policy==='fixed').map((b:any)=>db.collection('catalogueSourcePriceBaselines').doc(b.serviceId)));
  return{d,before,after:{...before,description:payload.description},registry:r,records:baselines.map((s:any)=>({serviceId:s.id,document:s.data()}))};
 }
 return{
 async review(raw:unknown){authorize();await config.assertQualifiedRuntime();const p=input.parse(raw);await state(p.draftId,p.expectedVersion,['draft']);const reviewed:any=await actual.review(p);return this.prepare({draftId:reviewed.id,expectedVersion:reviewed.version})},
 async prepare(raw:unknown){authorize();await config.assertQualifiedRuntime();const p=input.parse(raw),current=await state(p.draftId,p.expectedVersion,['reviewed']),snapshot=await config.readSnapshot(),plan=prepareNativeDescriptionUpdate({snapshot,registry:current.registry,beforeBaselineDocuments:current.records,beforeService:current.before,afterService:current.after,canonicalReview:{draftId:current.d.id,version:current.d.version,reviewHash:current.d.reviewHash},operationId:'description_'+hash({draft:current.d.reviewHash,source:snapshot.sourceHash,registry:current.registry.version}).slice(0,40)}),ticketId='description_review_'+plan.reviewHash.slice(0,40),refs=[db.collection('catalogueDrafts').doc(p.draftId),db.collection('services').doc(current.before.id),db.collection('catalogueSourceRegistries').doc(actor.tenantId),db.collection('catalogueSourceAccessLocks').doc(actor.tenantId),db.collection('cataloguePublishLocks').doc(actor.tenantId),...current.records.map((x:any)=>db.collection('catalogueSourcePriceBaselines').doc(x.serviceId))];
  await db.runTransaction(async(tx:any)=>{const rows=await Promise.all(refs.map(ref=>tx.get(ref))),d=rows[0].data(),s=rows[1].data(),r=rows[2].data(),lock=rows[3].data(),publisher=rows[4].data();if(hash(d??null)!==hash(current.d)||hash(s??null)!==hash(current.before)||hash(r??null)!==hash(current.registry)||lock?.activeOperationId||publisher?.activePublishId||publisher?.activeSharedOperationId||current.records.some((x:any,i:number)=>hash(rows[i+5].data()??null)!==hash(x.document??null)))fail('Description review preimage changed');tx.set(tickets.doc(ticketId),{id:ticketId,tenantId:actor.tenantId,reviewedBy:actor.uid,hash:plan.reviewHash,draftHash:hash(current.d),plan,createdAt:new Date().toISOString(),productionExecutable:false})});
  return{id:ticketId,hash:plan.reviewHash,operationId:plan.operationId,serviceId:current.before.id,sourceCell:plan.a1,beforeDescription:plan.beforeDescription,afterDescription:plan.afterDescription,requiresExpandedWriteApproval:false,requiresRuntimeQualification:true,productionExecutable:false,publishAvailable:false};
 },
 async publish(_raw:unknown){authorize();fail('Description durable lifecycle and private delivery are not qualified; no publish route')}
 };
}

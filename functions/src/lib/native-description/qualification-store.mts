import type{Firestore,Transaction}from'firebase-admin/firestore';
import{hash}from'./fingerprint.mjs';
const digest=/^[a-f0-9]{64}$/;
/** Separate, no-effect protocol records. Never returns a business plan,
 * execution authority, source coordinates or a native operation identifier. */
export function descriptionQualificationStore(db:Firestore){
 async function current(tx:Transaction,id:string){
  if(!/^qualification_[a-f0-9]{32}$/.test(id))throw Error('Exact qualification identifier required');
  const ref=db.collection('catalogueRuntimeQualifications').doc(id),row=(await tx.get(ref)).data();
  if(!row||row['kind']!=='description-no-effect-qualification-v1'||row['id']!==id||row['tenantId']!=='automodz'||!digest.test(row['sourceHash'])||!digest.test(row['runtimeDigest'])||!digest.test(row['carryReviewHash']))throw Error('Saved no-effect qualification required');
  const[g,r,j,s,p]=await Promise.all([tx.get(db.doc('catalogueSourceRuntimeGates/automodz')),tx.get(db.doc('catalogueSourceRegistries/automodz')),tx.get(db.doc('catalogueBindingMigrations/'+row['carryReviewHash'])),tx.get(db.doc('catalogueSourceAccessLocks/automodz')),tx.get(db.doc('cataloguePublishLocks/automodz'))]);
  const gate=g.data(),journal=j.data();
  if(gate?.['state']!=='maintenance'||gate['tenantId']!=='automodz'||gate['reviewHash']!==row['carryReviewHash']||gate['mappingVersion']!==row['mappingVersion']||gate['activeOperationId']||gate['oldHandlersQuiesced']!==true||gate['allHandlersVersionVerified']!==true||hash(r.data()??null)!==row['registryHash']||journal?.['phase']!=='metadata-carried-held'||journal['reviewHash']!==row['carryReviewHash']||journal['sourceHash']!==row['sourceHash']||s.data()?.['activeOperationId']||p.data()?.['activePublishId']||p.data()?.['activeSharedOperationId'])throw Error('Exact held no-effect qualification required');
  return{ref,row};
 }
 return{
  resolveQualification:(id:string)=>db.runTransaction(async tx=>{const{row}=await current(tx,id);if(row['phase']!=='prepared'||row['attemptClaimed']===true)throw Error('Fresh qualification required');return{kind:row['kind'],id,sourceHash:row['sourceHash'],runtimeDigest:row['runtimeDigest'],mappingVersion:row['mappingVersion'],registryHash:row['registryHash'],sourceEffectsAllowed:false}}),
  claimQualification:(id:string)=>db.runTransaction(async tx=>{const{ref,row}=await current(tx,id);if(row['phase']!=='prepared')throw Error('Held qualification required');if(row['attemptClaimed']===true)return{claimed:false,id,sourceEffectsAllowed:false};tx.update(ref,{attemptClaimed:true});return{claimed:true,id,sourceEffectsAllowed:false}}),
 };
}

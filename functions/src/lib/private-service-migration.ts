/** Scoped migration primitive, not registered/exported as a callable or scheduled task. */
import {FieldValue, type Firestore} from 'firebase-admin/firestore';
const revision=(timestamp:{seconds:number;nanoseconds:number}|undefined)=>timestamp?`${timestamp.seconds}:${timestamp.nanoseconds}`:null;
const FIELDS=['internalRating','internalNotes','priceBasis','priceBasisAt'] as const;
export type PrivateServiceMove={serviceId:string;tenantId:string;expectedPublicUpdatedAt:string|null;expectedPrivateUpdatedAt:string|null;expectedPublicWriteTime:string;expectedPrivateWriteTime:string|null;expectedFields:Record<string,unknown>;backupReceipt:string};
/** Caller must store and verify an encrypted backup before calling. Receipt is an opaque reference, never raw source notes. */
export async function movePrivateServiceFields(db:Firestore,plan:PrivateServiceMove,verifyBackup:(receipt:string,expected:{serviceId:string;tenantId:string;fields:Record<string,unknown>})=>Promise<boolean>){
 if(!plan.serviceId||!plan.tenantId||!plan.backupReceipt||!await verifyBackup(plan.backupReceipt,{serviceId:plan.serviceId,tenantId:plan.tenantId,fields:plan.expectedFields}))throw Error('Verified encrypted backup required');
 return db.runTransaction(async tx=>{
  const publicRef=db.collection('services').doc(plan.serviceId),privateRef=db.collection('servicePrivate').doc(plan.serviceId);
  const [publicSnap,privateSnap]=await Promise.all([tx.get(publicRef),tx.get(privateRef)]);
  const service=publicSnap.data(),metadata=privateSnap.data();
  if(!service||service['tenantId']!==plan.tenantId||metadata&&metadata['tenantId']!==plan.tenantId)throw Error('Exact tenant/service mismatch');
  if(revision(publicSnap.updateTime)!==plan.expectedPublicWriteTime||revision(privateSnap.updateTime)!==plan.expectedPrivateWriteTime)throw Error('Document write revision changed');
  if((service['updatedAt']??null)!==plan.expectedPublicUpdatedAt||(metadata?.['updatedAt']??null)!==plan.expectedPrivateUpdatedAt)throw Error('Source revision changed');
  const fields=Object.fromEntries(FIELDS.filter(key=>service[key]!==undefined).map(key=>[key,service[key]]));
  if(JSON.stringify(fields)!==JSON.stringify(plan.expectedFields))throw Error('Source private fields changed');
  for(const key of FIELDS)if(fields[key]!==undefined&&metadata?.[key]!==undefined&&JSON.stringify(fields[key])!==JSON.stringify(metadata[key]))throw Error('Private metadata conflict');
  if(!Object.keys(fields).length)return{moved:0,serviceId:plan.serviceId};
  const now=new Date().toISOString();
  tx.set(privateRef,{tenantId:plan.tenantId,...fields,updatedAt:now},{merge:true});
  const patch:Record<string,unknown>={updatedAt:now};for(const key of Object.keys(fields))patch[key]=FieldValue.delete();
  if(service['priceEstimate']===undefined&&typeof fields['priceBasis']==='string')patch['priceEstimate']=/estimate/i.test(fields['priceBasis']);
  tx.update(publicRef,patch);
  return{moved:Object.keys(fields).length,serviceId:plan.serviceId};
 });
}
/** Explicit reviewed rollback only: restoring before-images re-exposes legacy public metadata. Never auto-run. */
export async function restorePrivateServiceFields(db:Firestore,backup:{serviceId:string;tenantId:string;publicBefore:Record<string,unknown>;privateBefore:Record<string,unknown>|null},expected:{publicWriteTime:string;privateWriteTime:string}){
 if(!backup.serviceId||backup.publicBefore['tenantId']!==backup.tenantId||backup.privateBefore&&backup.privateBefore['tenantId']!==backup.tenantId)throw Error('Restore tenant mismatch');
 return db.runTransaction(async tx=>{const publicRef=db.collection('services').doc(backup.serviceId),privateRef=db.collection('servicePrivate').doc(backup.serviceId);const [p,q]=await Promise.all([tx.get(publicRef),tx.get(privateRef)]);if(revision(p.updateTime)!==expected.publicWriteTime||revision(q.updateTime)!==expected.privateWriteTime)throw Error('Restore revision changed');if(p.data()?.['tenantId']!==backup.tenantId||q.data()?.['tenantId']!==backup.tenantId)throw Error('Restore live tenant mismatch');tx.set(publicRef,backup.publicBefore);if(backup.privateBefore)tx.set(privateRef,backup.privateBefore);else tx.delete(privateRef);return{restored:true,serviceId:backup.serviceId}});
}

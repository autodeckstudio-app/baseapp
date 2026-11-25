import type{Firestore,Transaction}from'firebase-admin/firestore';
/** Scoped transaction adapter for the existing description lifecycle, not a
 * global DB patch. The shared runtime gate is read before body reads/writes.
 * Only a complete canonical result for the same held operation can queue gate
 * release, in the exact same transaction as service/customer/journal commit.
 * All other states, failed callbacks and uncertain effects leave it held. */
export function descriptionCommitGatedDb(db:Firestore,beforeRelease?:(tx:Transaction)=>Promise<void>){
 const gate=db.collection('catalogueSourceRuntimeGates').doc('automodz');
 return{projectId:(db as Firestore&{projectId?:string}).projectId,collection:db.collection.bind(db),getAll:db.getAll.bind(db),runTransaction:<T>(body:(tx:Transaction)=>Promise<T>)=>db.runTransaction(async tx=>{const runtime=(await tx.get(gate)).data();const result=await body(tx);const row=result as Record<string,unknown>|null;
 if(row?.['phase']==='complete'&&typeof row['id']==='string'&&row['tenantId']==='automodz'){
 if(runtime?.['state']!=='ready'||runtime?.['oldHandlersQuiesced']!==true||runtime?.['activeOperationId']!==row['id'])throw Error('Exact held runtime gate required for canonical description commit');
 await beforeRelease?.(tx);tx.update(gate,{activeOperationId:null,lastDescriptionOperationId:row['id']});
 }
 return result;})};
}

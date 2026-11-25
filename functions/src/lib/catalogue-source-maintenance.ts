import type{Firestore}from'firebase-admin/firestore';
/** Gate for existing numeric/read/draft composition. Before migration, the
 * sole fixed installed mapping may run without a new marker. Once maintenance
 * is requested, missing/mixed/held states fail closed; never reset a baseline.
 * Installing this gate is a prerequisite, not proof old instances are drained.
 */
export async function assertSourceMaintenance(db:Firestore,expectedMapping:string,operationId?:string){const marker=(await db.collection('catalogueSourceRuntimeGates').doc('automodz').get()).data();if(!marker){if(expectedMapping==='price-list-20261120-approved')return;throw Error('Catalogue source migration is not installed')}if(marker['tenantId']!=='automodz'||marker['state']!=='ready'||marker['mappingVersion']!==expectedMapping||marker['oldHandlersQuiesced']!==true||marker['activeOperationId']&&marker['activeOperationId']!==operationId)throw Error('Catalogue source maintenance or held operation');}
/** Every async method call rechecks, not only construction. Callback is also
 * checked inside the source-write phase immediately before fixed-worker send.
 */
export function maintenanceGuardedPort<T extends object>(port:T,check:()=>Promise<void>):T{return new Proxy(port,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return async(...args:unknown[])=>{await check();return value.apply(target,args)}}})}
/** Transaction-level guard for direct draft mutations and shared panel saves.
 * Reads before any queued write so a concurrent maintenance reservation
 * retries/refuses the mutation instead of racing past a factory-time check. */
export async function assertSourceMaintenanceTransaction(tx:FirebaseFirestore.Transaction,db:Firestore,tenantId:string){if(tenantId!=='automodz')return;const [r,s,p]=await Promise.all([tx.get(db.collection('catalogueSourceRuntimeGates').doc(tenantId)),tx.get(db.collection('catalogueSourceAccessLocks').doc(tenantId)),tx.get(db.collection('cataloguePublishLocks').doc(tenantId))]);const runtime=r.data();if(runtime&&(runtime['state']!=='ready'||runtime['oldHandlersQuiesced']!==true||runtime['activeOperationId'])||s.data()?.['activeOperationId']||p.data()?.['activePublishId']||p.data()?.['activeSharedOperationId'])throw Error('Catalogue source or publication maintenance is active');}

/** Existing publisher/recovery transaction guard. Unlike a draft mutation,
 * the caller may own the publication lock. It never owns a description source
 * lock or maintenance runtime operation, so those always refuse old paths. */
export async function assertExistingPublisherTransaction(tx:FirebaseFirestore.Transaction,db:Firestore,tenantId:string,publishId?:string){if(tenantId!=='automodz')return;const[r,s,p]=await Promise.all([tx.get(db.collection('catalogueSourceRuntimeGates').doc(tenantId)),tx.get(db.collection('catalogueSourceAccessLocks').doc(tenantId)),tx.get(db.collection('cataloguePublishLocks').doc(tenantId))]);const runtime=r.data(),publisher=p.data();if(runtime&&(runtime['state']!=='ready'||runtime['oldHandlersQuiesced']!==true||runtime['activeOperationId'])||s.data()?.['activeOperationId']||publisher?.['activeSharedOperationId']||publisher?.['activePublishId']&&publisher['activePublishId']!==publishId)throw Error('Existing publisher unavailable during source maintenance');}

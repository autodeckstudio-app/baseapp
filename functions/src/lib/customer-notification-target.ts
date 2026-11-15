import type{Firestore,Transaction}from'firebase-admin/firestore';
/** Notification and push ownership is the sign-in UID, not a staged counter
 * customer document ID. Require the same unique current binding as reads. */
export async function readCustomerNotificationTarget(tx:Transaction,db:Firestore,tenantId:string,customerId:string):Promise<string|null>{
 const c=await tx.get(db.collection('customers').doc(customerId)),d=c.data(),uid=d?.['authUid'];if(!d||d['id']!==customerId||d['tenantId']!==tenantId||d['deletedAt']||typeof uid!=='string'||!uid)return null;
 const direct=await tx.get(db.collection('customers').doc(uid));if(direct.exists&&(direct.id!==customerId||direct.data()?.['authUid']!==uid||direct.data()?.['tenantId']!==tenantId||direct.data()?.['deletedAt']))return null;
 const matches=await tx.get(db.collection('customers').where('authUid','==',uid).limit(3));const live=matches.docs.filter(s=>s.data()['tenantId']===tenantId&&!s.data()['deletedAt']);return live.length===1&&live[0]!.id===customerId?uid:null;
}

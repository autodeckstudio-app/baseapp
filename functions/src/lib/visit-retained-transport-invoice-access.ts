import type{Firestore}from'firebase-admin/firestore';import type{AuthorizedUser}from'@autodeck/auth';import{HttpsError}from'firebase-functions/v2/https';import{assertRole}from'../middleware/auth.js';import{readVisitBilling}from'./visit-billing.js';import{readRetainedTransportIssuedProof}from'./visit-retained-transport-issued-proof.js';
const unavailable=():never=>{throw new HttpsError('not-found','Retained journey invoice unavailable.');};
/** DORMANT scoped read seam, no callable or public storage access. It validates
 * source/captured funding through the full private bill before projecting only
 * invoice content. Scope checked before that private financial retrieval. */
export async function readScopedRetainedTransportInvoice(db:Firestore,user:AuthorizedUser,invoiceId:string){
 assertRole(user,'customer','studio','admin','superadmin');if(!/^vti_[a-f0-9]{64}$/.test(invoiceId))return unavailable();
 return db.runTransaction(async tx=>{
  const raw=(await tx.get(db.collection('visitRetainedTransportInvoices').doc(invoiceId))).data();if(!raw||raw['id']!==invoiceId||raw['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&raw['studioId']!==user.claims.studioId)return unavailable();
  const customer=(await tx.get(db.collection('customers').doc(raw['customerId']))).data();if(!customer||customer['tenantId']!==user.claims.tenantId||customer['deletedAt']||customer['erasureState']==='purging'||user.claims.role==='customer'&&customer['authUid']!==user.uid)return unavailable();
  const bill=await readVisitBilling(tx,db,raw['visitId']),member=bill.members.find(m=>m.job.id===raw['jobId']),record=(await tx.get(db.collection('visitServiceReturns').doc(raw['jobId']))).data();
  if(!member||!record||record['retainedTransportInvoiceId']!==invoiceId||bill.visit.customerId!==raw['customerId']||bill.visit.studioId!==raw['studioId'])return unavailable();const plan=(await tx.get(db.collection('visitServiceReturnPlans').doc(record['planId']))).data();if(!plan)return unavailable();const proof=await readRetainedTransportIssuedProof(tx,db,record,plan['review'],member.job.priceBreakdown);if(!proof)return unavailable();return proof.invoice;
 });
}

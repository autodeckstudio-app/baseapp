import type{Firestore}from'firebase-admin/firestore';import type{AuthorizedUser}from'@autodeck/auth';import{HttpsError}from'firebase-functions/v2/https';import{z}from'zod';import{assertRole}from'../middleware/auth.js';import{readScopedRetainedVisitTransportInTransaction}from'./visit-retained-transport-read.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),schema=z.object({requestIds:z.array(id).min(1).max(20)}).strict();const fail=():never=>{throw new HttpsError('failed-precondition','Original journey list needs review. No partial list returned.');};
/** DORMANT exact-row batch. One transaction and max20 unique rows; no implicit
 * pagination, arbitrary tenant scan, partial success or not-found fallback.
 * Caller list must itself be scoped. Revalidates every supplied request before
 * private source retrieval, then returns verified retention or explicit legacy
 * disposition. No callable, direct rules, UI/listener or action authority. */
export async function readScopedRetainedTransportBatch(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'customer','studio','admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Choose at most20 exact journey rows.');const ids=parsed.data.requestIds;if(new Set(ids).size!==ids.length)return fail();
 return db.runTransaction(async tx=>{
  const scoped=[];
  // Validate the entire audience before any private financial proof is read.
  for(const requestId of ids){const r=(await tx.get(db.collection('pickupRequests').doc(requestId))).data();if(!r||r['id']!==requestId||r['bookingId']!==requestId||r['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&r['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Journey row unavailable.');
   const b=(await tx.get(db.collection('bookings').doc(requestId))).data(),c=(await tx.get(db.collection('customers').doc(r['customerId']))).data();
   if(!b||b['id']!==requestId||['tenantId','studioId','customerId'].some(k=>b[k]!==r[k])||!c||c['tenantId']!==user.claims.tenantId||c['deletedAt']||c['erasureState']==='purging'||user.claims.role==='customer'&&c['authUid']!==user.uid)throw new HttpsError('not-found','Journey row unavailable.');
   scoped.push({requestId,r,b});
  }
  const rows=[];for(const{requestId,r,b}of scoped){
   const visitId=b['visitId']??r['visitId'],jobId=r['jobId'];
   if(b['visitId']&&r['visitId']&&b['visitId']!==r['visitId'])return fail();
   // Grouped transport requires its exact job identity; never guess an anchor.
   if(visitId&&(!id.safeParse(visitId).success||!id.safeParse(jobId).success))return fail();
   if(visitId){const job=(await tx.get(db.collection('jobs').doc(jobId))).data(),visit=(await tx.get(db.collection('carVisits').doc(visitId))).data();
    if(!job||job['id']!==jobId||job['bookingId']!==requestId||job['visitId']!==visitId||!visit||visit['id']!==visitId||visit['transportJobId']!==jobId||
     ['tenantId','studioId','customerId','vehicleId'].some(k=>job[k]!==b[k]||visit[k]!==b[k]))return fail();
    if(job['visitServiceReturnId']&&!b['visitServiceReturnId'])return fail();
   }
   const root=jobId?(await tx.get(db.collection('visitServiceReturns').doc(jobId))).data():null,retention=jobId?(await tx.get(db.collection('visitTransportRetentions').doc(jobId))).data():null,closure=jobId?(await tx.get(db.collection('visitTransportClosures').doc(jobId))).data():null;
   if(root||retention||closure||b['visitServiceReturnId']||b['transportReadRevision']){
    if(!visitId||!root||!retention)return fail();const physical=await readScopedRetainedVisitTransportInTransaction(tx,db,user,visitId);
    if(physical.requestId!==requestId||physical.jobId!==jobId)return fail();rows.push({requestId,kind:'retained' as const,physical});
   }else rows.push({requestId,kind:'legacy' as const});
  }
  return{rows};
 });
}

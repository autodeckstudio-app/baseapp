import type{Firestore}from'firebase-admin/firestore';import type{AuthorizedUser}from'@autodeck/auth';import{z}from'zod';import{HttpsError}from'firebase-functions/v2/https';
import{assertRole}from'../middleware/auth.js';import{refundIngressId,readIngressOriginalRequest,assertIngressCanResolve,assertIngressResolved}from'./visit-refund-ingress-proof.js';import{visitReturnHash}from'./visit-service-return-state.js';
const schema=z.object({eventId:z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),payloadHash:z.string().regex(/^[a-f0-9]{64}$/),resolved:z.literal(true)}).strict();
/** DORMANT local resolution only after independent fetched processed proof was
 * already committed by the existing return runner. No provider call, create,
 * money projection or manual override. Missing/conflicting events stay held. */
export async function resolveVisitRefundIngress(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'admin','superadmin');const parsed=schema.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Review the exact refund event.');const d=parsed.data;
 return db.runTransaction(async tx=>{
  const ref=db.collection('visitRefundIngress').doc(refundIngressId(d.eventId)),row=(await tx.get(ref)).data();
  if(!row||row['tenantId']!==user.claims.tenantId||row['eventId']!==d.eventId||row['payloadHash']!==d.payloadHash||typeof row['referenceId']!=='string')throw new HttpsError('not-found','Refund event unavailable.');
  const r=await readIngressOriginalRequest(tx,db,row['referenceId']);if(!r)throw new HttpsError('failed-precondition','Original refund unavailable.');
  if(row['status']==='reconciled'){assertIngressResolved(row,ref.id,r);return{outcome:'reconciled' as const,alreadyResolved:true};}
  if(row['status']!=='reconciliation_required')throw new HttpsError('failed-precondition','Refund event needs review.');
  assertIngressCanResolve(row,ref.id,r);const now=new Date().toISOString(),next={...row,status:'reconciled',reason:'independently_verified_return',evidenceHash:visitReturnHash(r.evidence),recognisedAt:r.updatedAt,resolvedBy:user.uid,resolvedAt:now,updatedAt:now};
  tx.update(ref,{...next,resolutionHash:visitReturnHash(next)});return{outcome:'reconciled' as const,alreadyResolved:false};
 });
}

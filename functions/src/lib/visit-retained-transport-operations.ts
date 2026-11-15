import type{Firestore}from'firebase-admin/firestore';import type{AuthorizedUser}from'@autodeck/auth';import{HttpsError}from'firebase-functions/v2/https';import{z}from'zod';
import{assertRole}from'../middleware/auth.js';import{readScopedRetainedTransportList}from'./visit-retained-transport-batch.js';import{readScopedRetainedVisitTransportInTransaction}from'./visit-retained-transport-read.js';import{readVisitBilling}from'./visit-billing.js';import{visitReturnHash}from'./visit-service-return-state.js';import{readVisitTransport,checkVisitDrop}from'./visit-transport.js';import{progressRetainedVisitTransport}from'./visit-retained-transport-progress.js';import{closeUnusedVisitTransport}from'./visit-unused-transport-closure.js';import type{Booking}from'@autodeck/core';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),hash=z.string().regex(/^[a-f0-9]{64}$/),input=z.object({requestId:id}).strict();
const fail=():never=>{throw new HttpsError('failed-precondition','Journey changed. Review again.');};
/** Staff-only exact action review. Does not grant money/refund permission or
 * relax any original writer checks. Tokens bind the displayed decision. */
export async function reviewRetainedTransportOperations(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'studio','admin','superadmin');const d=input.safeParse(raw);if(!d.success)throw new HttpsError('invalid-argument','Choose the original journey.');
 const scoped=await readScopedRetainedTransportList(db,user,{requestIds:[d.data.requestId]}),row=scoped.batch.rows[0];if(row?.kind!=='retained')return fail();
 return db.runTransaction(async tx=>{
  const physical=await readScopedRetainedVisitTransportInTransaction(tx,db,user,row.physical.visitId);if(physical.requestId!==d.data.requestId)return fail();
  const bill=await readVisitBilling(tx,db,physical.visitId),r=(await tx.get(db.collection('pickupRequests').doc(physical.requestId))).data(),b=(await tx.get(db.collection('bookings').doc(physical.requestId))).data();if(!r||!b)return fail();
  const actions:{action:'pickup'|'drop'|'close_unused';label:string;enabled:boolean;reason:string|null}[]=[];
  for(const leg of physical.neededLegs){let reason:string|null=null;
   try{if(r['status']!=='CONFIRMED')throw new HttpsError('failed-precondition','Review original approval');const scope=await readVisitTransport(tx,db,b as Booking);if(!scope)throw Error();if(leg==='drop')await checkVisitDrop(tx,db,scope);else if(scope.members.some(m=>m.job.status!=='CANCELLED'&&m.job.status!=='PENDING_VEHICLE'))reason='Check vehicle receipt';}catch(e){reason=e instanceof HttpsError?e.message:'Journey needs review';}
   actions.push({action:leg,label:leg==='pickup'?'Picked up':'Dropped back',enabled:reason===null,reason});
  }
  if(physical.requiresExplicitUnusedClosure&&(user.claims.role==='admin'||user.claims.role==='superadmin')){const reason=physical.neededLegs.length?'Finish retained legs':bill.visit.activeHandoverId?'Finish handover review':null;actions.push({action:'close_unused',label:'Close unused legs',enabled:reason===null,reason});}
  const returns=bill.returnReviews.find(p=>p.jobId===physical.jobId);if(!returns)return fail();
  const returnSummary={retainedPaise:returns.retainedPaise,returnPaise:returns.returnPaise,returnedPaise:returns.returnedPaise,status:returns.status};
  const state={returnSummary,requestId:physical.requestId,visitId:physical.visitId,jobId:physical.jobId,physical,actions,requestToken:visitReturnHash(r),billToken:bill.review.reviewToken};
  return{...state,reviewToken:visitReturnHash(state)};
 });
}
const command=z.object({visitId:id,jobId:id,operationId:z.string().uuid(),requestToken:hash,action:z.enum(['pickup','drop','close_unused']),billToken:hash,unusedLegs:z.array(z.enum(['pickup','drop'])).max(2),confirmed:z.literal(true)}).strict();
/** Exact reviewed parameters are retained on response loss. The original
 * transaction writers revalidate them and own atomic idempotence. A client
 * cannot gain authority by editing a review, hash or displayed action. */
export async function executeRetainedTransportOperation(db:Firestore,user:AuthorizedUser,raw:unknown){
 assertRole(user,'studio','admin','superadmin');const parsed=command.safeParse(raw);if(!parsed.success)throw new HttpsError('invalid-argument','Confirm the reviewed journey action.');const d=parsed.data;
 if(d.action==='close_unused')return closeUnusedVisitTransport(db,user,{visitId:d.visitId,jobId:d.jobId,operationId:d.operationId,reviewToken:d.billToken,requestToken:d.requestToken,unusedLegs:d.unusedLegs,closed:true});
 return progressRetainedVisitTransport(db,user,{visitId:d.visitId,jobId:d.jobId,operationId:d.operationId,requestToken:d.requestToken,leg:d.action,completed:true});
}

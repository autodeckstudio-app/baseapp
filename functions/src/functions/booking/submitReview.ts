// One review per completed visit. Linked jobs share the booking's canonical review.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { COLLECTIONS } from '@autodeck/database';
import { extractCustomerUser, assertRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { enforceRateLimit, subjectFrom } from '../../middleware/rateLimit.js';
import { resolveCustomerDocId } from '../../lib/customer-identity.js';
import { shouldEnforceAppCheck } from '../../lib/environment.js';
import { visitReviewTargetSchema,resolveVisitReviewTarget } from '../../lib/visit-review-target.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const schema=z.object({bookingId:id.optional(),jobId:id.optional(),rating:z.number().int().min(1).max(5),comment:z.string().trim().max(500).optional()}).strict().refine(v=>!!v.bookingId!==!!v.jobId,'Choose one visit reference.');
async function identity(request:any){const user=extractCustomerUser(request);assertRole(user,'customer');await enforceRateLimit(subjectFrom(user),'booking.review');const db=getFirestore();const cid=(await resolveCustomerDocId(db,COLLECTIONS.customers(),user.claims.tenantId,user.uid))??user.uid;return {user,db,cid};}
export const submitReview=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 extractCustomerUser(request); // Enforce default-deny roles before input validation.
 const data=validate(schema,request.data);const {user,db,cid}=await identity(request);
 return db.runTransaction(async tx=>{const target=await resolveVisitReviewTarget(db,tx,data,user.claims.tenantId,[cid,user.uid]);const ref=db.collection(COLLECTIONS.reviews()).doc(target.id);const prior=(await tx.get(ref)).data();
  if(prior&&(prior['tenantId']!==target.tenantId||![cid,user.uid].includes(prior['customerId'])||prior['bookingId']!==target.bookingId||(target.source==='walkin'&&prior['jobId']!==target.jobId)))throw new HttpsError('failed-precondition','Feedback needs an office check.');
  const now=new Date().toISOString();tx.set(ref,{...target,customerId:cid,rating:data.rating,comment:data.comment??'',createdAt:prior?.['createdAt']??now,updatedAt:now});return {ok:true};
 });
});
export const getMyVisitReview=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 extractCustomerUser(request); // Enforce default-deny roles before input validation.
 const input=validate(visitReviewTargetSchema,request.data);const {user,db,cid}=await identity(request);
 return db.runTransaction(async tx=>{const target=await resolveVisitReviewTarget(db,tx,input,user.claims.tenantId,[cid,user.uid]);const row=(await tx.get(db.collection(COLLECTIONS.reviews()).doc(target.id))).data();
  if(!row)return {review:null};if(row['tenantId']!==target.tenantId||![cid,user.uid].includes(row['customerId'])||row['bookingId']!==target.bookingId||(target.source==='walkin'&&row['jobId']!==target.jobId))throw new HttpsError('not-found','Feedback unavailable.');
  return {review:{rating:row['rating'],comment:row['comment']}};
 });
});

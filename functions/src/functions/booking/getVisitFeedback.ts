// Read one completed visit's feedback. No separate inbox or customer directory.
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{validate}from'../../middleware/validate.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import { shouldEnforceAppCheck }from'../../lib/environment.js';
import{visitReviewTargetSchema,resolveVisitReviewTarget}from'../../lib/visit-review-target.js';
export const getVisitFeedback=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const input=validate(visitReviewTargetSchema,request.data);await enforceRateLimit(subjectFrom(user),'read.jobs');
 const db=getFirestore();return db.runTransaction(async tx=>{
  const source=(await tx.get(db.collection(input.jobId?'jobs':'bookings').doc((input.jobId??input.bookingId)!))).data();
  if(!source||source['tenantId']!==user.claims.tenantId||typeof source['customerId']!=='string')throw new HttpsError('not-found','Visit unavailable.');
  const target=await resolveVisitReviewTarget(db,tx,input,user.claims.tenantId,[source['customerId']]);
  const review=(await tx.get(db.collection('reviews').doc(target.id))).data();if(!review)return {review:null};
  if(review['tenantId']!==target.tenantId||review['customerId']!==target.customerId||review['bookingId']!==target.bookingId||(target.source==='walkin'&&review['jobId']!==target.jobId))throw new HttpsError('not-found','Feedback unavailable.');
  if(!Number.isInteger(review['rating'])||review['rating']<1||review['rating']>5)throw new HttpsError('failed-precondition','Feedback needs an office check.');
  return {review:{rating:review['rating'],comment:typeof review['comment']==='string'?review['comment']:'',updatedAt:typeof review['updatedAt']==='string'?review['updatedAt']:null}};
 });
});

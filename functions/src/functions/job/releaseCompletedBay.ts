import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {z} from 'zod';
import type {ServiceJob,Booking} from '@autodeck/core';
import {hasReleasedBay} from '@autodeck/core';
import {COLLECTIONS} from '@autodeck/database';
import {extractUser,assertRole,assertTenant} from '../../middleware/auth.js';
import {validate} from '../../middleware/validate.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {writeAuditLog} from '../../middleware/audit.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
const schema=z.object({jobId:z.string().min(1),confirmWorkCompleteAndBayEmpty:z.literal(true)}).strict();
// Explicit physical confirmation only. Ready status alone NEVER frees a bay.
// This does not deliver a car, mark a payment paid or issue protection/warranty.
export const releaseCompletedBay=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');
 const data=validate(schema,request.data);await enforceRateLimit(subjectFrom(user),'job.assignBay');
 const db=getFirestore(),ref=db.collection(COLLECTIONS.jobs()).doc(data.jobId);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Job not found.');
  const job=snap.data() as ServiceJob;assertTenant(user,job.tenantId);
  if(user.claims.role==='studio'&&user.claims.studioId!==job.studioId)throw new HttpsError('permission-denied','Job belongs to another studio.');
  if(job.status!=='READY_FOR_DELIVERY'||!job.bayId)throw new HttpsError('failed-precondition','Only completed work waiting for pickup can release an empty bay.');
  if(hasReleasedBay(job))return {jobId:data.jobId,released:true,alreadyReleased:true,bayReleasedAt:job.bayReleasedAt};
  const lock=db.collection(COLLECTIONS.bayLocks()).doc(`${job.tenantId}__${job.studioId}__${job.bayId}`);await tx.get(lock);
  const bookingRef=job.bookingId?db.collection(COLLECTIONS.bookings()).doc(job.bookingId):null;
  if(bookingRef){const b=(await tx.get(bookingRef)).data() as Booking|undefined;if(!b||b.tenantId!==job.tenantId||b.studioId!==job.studioId||b.customerId!==job.customerId||b.bayId!==job.bayId)throw new HttpsError('failed-precondition','Linked booking changed. Reload before releasing the bay.');}
  const now=new Date().toISOString(),receipt={bayReleasedAt:now,bayReleasedBy:user.uid,updatedAt:now};
  tx.update(ref,receipt);if(bookingRef)tx.update(bookingRef,receipt);tx.set(lock,{lastAssignedAt:now});
  writeAuditLog(tx,{action:'job.bay_released',entityType:'ServiceJob',entityId:data.jobId,user,studioId:job.studioId,before:{bayId:job.bayId},after:{bayId:job.bayId,bayReleasedAt:now,workCompleteAndBayEmpty:true},metadata:{operation:'release_completed_empty_bay'}});
  return {jobId:data.jobId,released:true,bayReleasedAt:now};
 },{maxAttempts:10});
});

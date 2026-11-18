import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {z} from 'zod';
import type {ServiceJob,AuditLog} from '@autodeck/core';
import {extractUser,assertRole,assertTenant} from '../../middleware/auth.js';
import {validate} from '../../middleware/validate.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {readCustomerNotificationTarget} from '../../lib/customer-notification-target.js';
const schema=z.object({jobId:z.string().min(1).max(128).regex(/^[^/]+$/),expectedUpdatedAt:z.string().min(1).max(128)}).strict();
export const reportJobDelay=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const data=validate(schema,request.data);await enforceRateLimit(subjectFrom(user),'job.reportDelay');
 const db=getFirestore();return db.runTransaction(async tx=>{
  const ref=db.collection('jobs').doc(data.jobId),job=(await tx.get(ref)).data() as ServiceJob|undefined;
  if(!job)throw new HttpsError('not-found','Job not found.');assertTenant(user,job.tenantId);
  if(user.claims.role==='studio'&&user.claims.studioId!==job.studioId)throw new HttpsError('permission-denied','Job belongs to another studio.');
  if(job.delayReported)return {jobId:job.id,alreadyReported:true};
  if(job.updatedAt!==data.expectedUpdatedAt)throw new HttpsError('failed-precondition','Job changed. Reload before reporting a delay.');
  if(!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK'].includes(job.status))throw new HttpsError('failed-precondition','Only work in the studio can be reported delayed.');
  if(!await readCustomerNotificationTarget(tx,db,job.tenantId,job.customerId))throw new HttpsError('failed-precondition','Customer account could not be verified. No delay alert was recorded.');
  const auditRef=db.collection('auditLog').doc(),at=new Date().toISOString();
  const log:AuditLog={id:auditRef.id,tenantId:job.tenantId,studioId:job.studioId,action:'job.delay_reported',entityType:'ServiceJob',entityId:job.id,performedBy:user.uid,performedByName:user.displayName||user.email||'Studio team',performedByRole:user.claims.role,targetLabel:'Delay reported',before:null,after:{delayReported:{at,by:user.uid,auditId:auditRef.id}},metadata:{},createdAt:at};
  tx.update(ref,{delayReported:{at,by:user.uid,auditId:auditRef.id},updatedAt:at});tx.create(auditRef,log);
  return {jobId:job.id,alreadyReported:false};
 });
});

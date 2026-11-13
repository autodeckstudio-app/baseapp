import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {z} from 'zod';
import type {ServiceJob} from '@autodeck/core';
import {COLLECTIONS} from '@autodeck/database';
import {extractUser,assertRole,assertStudio} from '../../middleware/auth.js';
import {validate} from '../../middleware/validate.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
import {holdCashReconciliation,runCashReconciliation} from '../../lib/cash-reconciliation.js';
import {getPaymentProvider} from '../../lib/razorpay-provider.js';

const id=z.string().min(1).max(128).regex(/^[^/]+$/);
const readSchema=z.object({jobId:id}).strict();
const key=z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/);
const holdSchema=z.object({jobId:id,paymentId:id,receiptKey:key,receivedPaise:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),receivedAt:z.string().datetime({offset:true}),collectedBy:z.string().trim().min(1).max(128),reason:z.string().trim().min(1).max(200)}).strict();
const runSchema=z.object({reconciliationId:key,confirmCloseUnpaidLink:z.literal(true)}).strict();
const config={region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()};
// SOURCE PREPARATION ONLY: exported here for isolated tests, deliberately NOT
// exported by index.ts until a separately reviewed financial activation release.
export const getCashReconciliationReview=onCall(config,async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');
 const data=validate(readSchema,request.data);await enforceRateLimit(subjectFrom(user),'payment.recordManual');
 const db=getFirestore();
 return db.runTransaction(async tx=>{
  const js=await tx.get(db.collection(COLLECTIONS.jobs()).doc(data.jobId));
  if(!js.exists)throw new HttpsError('not-found','Job not found.');
  const job=js.data() as ServiceJob&{cashReconciliationId?:string};
  if(job.id!==data.jobId||job.tenantId!==user.claims.tenantId)throw new HttpsError('permission-denied','Job scope mismatch.');assertStudio(user,job.studioId,'Job');
  if(!job.cashReconciliationId)return{fact:null};
  const snap=await tx.get(db.collection('cashReconciliations').doc(job.cashReconciliationId));
  const f=snap.data();
  if(!f||f.id!==job.cashReconciliationId||f.jobId!==job.id||f.tenantId!==job.tenantId||f.studioId!==job.studioId||f.customerId!==job.customerId)throw new HttpsError('failed-precondition','Cash fact scope mismatch.');
  return{fact:{id:f.id,state:f.state,receivedPaise:f.receivedPaise,receivedAt:f.receivedAt,collectedBy:f.collectedBy,reason:f.reason,paymentId:f.paymentId,recordedBy:f.recordedBy,createdAt:f.createdAt},balanceDuePaise:Math.max(0,job.totalAmount-(job.offlineSettlement?.appliedPaise??0)),officeReturnDuePaise:job.offlineSettlement?.officeReturnDuePaise??0};
 });
});
export const recordCashAlreadyReceived=onCall(config,async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');
 const data=validate(holdSchema,request.data);await enforceRateLimit(subjectFrom(user),'payment.recordManual');
 return holdCashReconciliation(getFirestore(),user,data);
});
export const reconcileCashAlreadyReceived=onCall({...config,secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]},async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');
 const data=validate(runSchema,request.data);await enforceRateLimit(subjectFrom(user),'payment.recordManual');
 return runCashReconciliation(getFirestore(),user,data.reconciliationId,getPaymentProvider());
});

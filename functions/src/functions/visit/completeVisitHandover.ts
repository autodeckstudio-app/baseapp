import {jobStageCommand} from "@autodeck/core";
import {z} from 'zod';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {extractUser,assertRole} from '../../middleware/auth.js';
import {shouldEnforceAppCheck} from '../../lib/environment.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {advanceJobStatus} from '../job/advanceJobStatus.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),input=z.object({manifestId:id,confirmed:z.literal(true)}).strict();
/** One staff confirmation, sequential existing guarded transitions. Not an
 * atomic cross-job transaction. A failed member stops the attempt; committed
 * members stand and retries skip only their exact durable outcomes. */
export const completeVisitHandover=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const p=input.safeParse(request.data);if(!p.success)throw new HttpsError('invalid-argument','Review shared handover.');
 await enforceRateLimit(subjectFrom(user),'job.advanceStatus');const db=getFirestore(),ref=db.collection('visitHandovers').doc(p.data.manifestId);
 async function read(){return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),m=snap.data();if(!m||m['id']!==snap.id||m['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&m['studioId']!==user.claims.studioId||!Array.isArray(m['jobIds'])||m['jobIds'].length<1||m['jobIds'].length>20||new Set(m['jobIds']).size!==m['jobIds'].length||!m['expected']||!m['outcomes'])throw new HttpsError('not-found','Shared handover unavailable.');
  const visit=(await tx.get(db.collection('carVisits').doc(m['visitId']))).data();
  if(!visit||visit['activeHandoverId']!==snap.id||visit['revision']!==m['visitRevision']||JSON.stringify(visit['jobIds'])!==JSON.stringify(m['jobIds'])||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>visit[k]!==m[k]))throw new HttpsError('failed-precondition','Shared handover changed. Reload.');
  const car=(await tx.get(db.collection('vehicles').doc(m['vehicleId']))).data();if(!car||car['tenantId']!==m['tenantId']||car['ownerId']!==m['customerId']||car['deletedAt'])throw new HttpsError('failed-precondition','Visit ownership changed.');
  for(const jobId of m['jobIds']){const job=(await tx.get(db.collection('jobs').doc(jobId))).data();if(!job||job['id']!==jobId||job['visitId']!==m['visitId']||(['tenantId','studioId','customerId','vehicleId']as const).some(k=>job[k]!==m[k]))throw new HttpsError('failed-precondition','Visit member changed.');const outcome=m['outcomes'][jobId];if(!outcome&&job['status']==='DELIVERED'||!m['expected'][jobId]&&job['status']!=='CANCELLED')throw new HttpsError('failed-precondition','Handover outcome needs review.');if(outcome&&(outcome.status!=='delivered'||job['status']!=='DELIVERED'||outcome.at!==job['sealedAt']))throw new HttpsError('failed-precondition','Delivered outcome changed.');}
  return m;
 });}
 const initial=await read();let error:string|null=null;
 for(const jobId of initial['jobIds'] as string[]){
  if(!initial['expected'][jobId]||initial['outcomes'][jobId]?.status==='delivered')continue;
  try{await advanceJobStatus.run({...request,data:{jobId,...jobStageCommand({status:"READY_FOR_DELIVERY",updatedAt:initial["expected"][jobId].updatedAt}),recordedWorkRevision:initial['expected'][jobId].recordedWorkRevision,visitHandoverId:ref.id}});}
  catch(err){error=err instanceof HttpsError?err.message:'Handover stopped. Reload remaining services.';break;}
 }
 const current=await read();return{manifestId:ref.id,status:Object.keys(current['expected']).every(id=>current['outcomes'][id]?.status==='delivered')?'complete':'incomplete',outcomes:Object.fromEntries(Object.entries(current['outcomes']).map(([id,v])=>[id,{status:(v as any).status,at:(v as any).at}])),error};
});

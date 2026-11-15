import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{z}from'zod';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{rescueCataloguePublish}from'../../lib/catalogue-rescue.js';
import{composePrivateCataloguePort}from'../../lib/catalogue-runtime-composition.js';
import{catalogueWorkerConfig}from'./catalogueRuntime.js';

const rescueInput=z.object({
  publishId:z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  op:z.enum(['write','verify','commit']),
  cursor:z.number().int().nonnegative().optional(),
  limit:z.number().int().positive().max(20).optional(),
}).strict();

/**
 * Bounded one-shot rescue for a wedged managed catalogue publish. Same admin
 * + tenant + verified App Check gate and same controller service account as
 * the managed callables; work happens in checkpointed slices at the worker's
 * quota pace, so a batch too large for one 60s inspect can still finish.
 * Detailed step errors are returned to the verified admin operator, matching
 * the detail level inspectManagedCatalogueRecovery already exposes.
 */
export const recoverManagedCataloguePublish=onCall({region:'asia-south1',enforceAppCheck:true,serviceAccount:'catalogue-publish-controller@autodeck-studio.iam.gserviceaccount.com',invoker:'public',maxInstances:1,minInstances:0,timeoutSeconds:540},async(request)=>{
  const user=extractUser(request);
  assertRole(user,'admin','superadmin');
  if(user.claims.tenantId!=='automodz')throw new HttpsError('permission-denied','Managed catalogue tenant required.');
  if(!request.app?.appId)throw new HttpsError('failed-precondition','Verified App Check required for managed catalogue publishing.');
  const data=rescueInput.parse(request.data);
  await enforceRateLimit(subjectFrom(user),data.op==='verify'?'read.catalogue':'service.update');
  const db=getFirestore();
  const port=await composePrivateCataloguePort(db,catalogueWorkerConfig());
  try{
    return await rescueCataloguePublish(db,port,{publishId:data.publishId,op:data.op,actor:user.uid,actorRole:user.claims.role??'admin',...(data.cursor!==undefined?{cursor:data.cursor}:{}),...(data.limit!==undefined?{limit:data.limit}:{})});
  }catch(error){
    if(error instanceof HttpsError)throw error;
    const reason=error instanceof Error?error.message:'unknown';
    throw new HttpsError('aborted','Catalogue recovery step unavailable: '+reason.slice(0,180));
  }
});

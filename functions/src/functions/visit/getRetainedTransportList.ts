import{onCall,HttpsError,type CallableRequest}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{readScopedRetainedTransportList}from'../../lib/visit-retained-transport-batch.js';
import{isProductionProject}from'../../lib/environment.js';
/** Local preview entrypoint only. Absent from the production index. Even an
 * accidental export cannot run in a non-demo project or non-emulator runtime. */
export async function readLocalRetainedTransportList(request:CallableRequest){
 if(process.env['FUNCTIONS_EMULATOR']!=='true'||!process.env['GCLOUD_PROJECT']?.startsWith('demo-')||isProductionProject())throw new HttpsError('failed-precondition','Local preview only.');
 const user=extractUser(request);assertRole(user,'customer','studio','admin','superadmin');
 return readScopedRetainedTransportList(getFirestore(),user,request.data);
}
export const getRetainedTransportList=onCall({region:'asia-south1',enforceAppCheck:false},readLocalRetainedTransportList);

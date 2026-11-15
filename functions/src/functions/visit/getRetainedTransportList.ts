import{assertConnectedVisitRuntime}from'../../lib/connected-visit-release.js';
import{onCall,HttpsError,type CallableRequest}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{readScopedRetainedTransportList}from'../../lib/visit-retained-transport-batch.js';

import{shouldEnforceAppCheck}from'../../lib/environment.js';
/** Default-off coordinated release entrypoint. Original scope proof remains mandatory. */
export async function readLocalRetainedTransportList(request:CallableRequest){
 const user=extractUser(request);assertRole(user,'customer','studio','admin','superadmin');
 assertConnectedVisitRuntime();
 return readScopedRetainedTransportList(getFirestore(),user,request.data);
}
export const getRetainedTransportList=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},readLocalRetainedTransportList);

import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{assertConnectedVisitRuntime}from'../../lib/connected-visit-release.js';
import{onCall,HttpsError,type CallableRequest}from'firebase-functions/v2/https';import{getFirestore}from'firebase-admin/firestore';import{extractUser,assertRole}from'../../middleware/auth.js';import{shouldEnforceAppCheck}from'../../lib/environment.js';import{reviewRetainedTransportOperations,executeRetainedTransportOperation}from'../../lib/visit-retained-transport-operations.js';
function local(request:CallableRequest){const user=extractUser(request);assertRole(user,'studio','admin','superadmin');assertConnectedVisitRuntime();return user;}
export async function reviewLocalRetainedTransport(request:CallableRequest){const user=local(request);return reviewRetainedTransportOperations(getFirestore(),user,request.data);}
export async function executeLocalRetainedTransport(request:CallableRequest){const user=local(request);return executeRetainedTransportOperation(getFirestore(),user,request.data);}
export const reviewRetainedTransport=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{const user=local(request);await enforceRateLimit(subjectFrom(user),'job.advanceStatus');return reviewLocalRetainedTransport(request);});
export const executeRetainedTransport=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{const user=local(request);await enforceRateLimit(subjectFrom(user),'job.advanceStatus');return executeLocalRetainedTransport(request);});

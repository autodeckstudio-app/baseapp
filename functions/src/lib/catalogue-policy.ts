import{HttpsError}from'firebase-functions/v2/https';
/** Managed catalogue has one reviewed publication path. No client flag can opt out. */
export function assertDirectCatalogueMutationAllowed(tenantId:string){if(tenantId==='automodz')throw new HttpsError('failed-precondition','Use catalogue drafts, review and publish. Direct live edits are disabled.');}

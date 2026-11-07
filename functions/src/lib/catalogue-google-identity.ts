import{GoogleAuth,OAuth2Client}from'google-auth-library';import type{WorkerAuthContext}from'./catalogue-worker-protocol.js';
const googleIssuers=new Set(['accounts.google.com','https://accounts.google.com']);
/** Google library performs signature verification with Google certificates,
 * issuer/audience/time checks. Explicit exact verified email + sub/time checks
 * below restrict it to the reviewed service account, never an end-user token.
 */
export function googleCatalogueIdentityVerifier(config:{audience:string;controllerPrincipal:string},client:Pick<OAuth2Client,'verifyIdToken'>=new OAuth2Client()){
 if(!/^https:\/\/[^/]+$/.test(config.audience)||!config.controllerPrincipal.endsWith('.iam.gserviceaccount.com'))throw Error('Exact Google worker identity configuration required');
 return async(token:string,audience:string):Promise<WorkerAuthContext>=>{if(audience!==config.audience)throw Error('Unexpected worker audience');const ticket=await client.verifyIdToken({idToken:token,audience:config.audience});const p=ticket.getPayload(),now=Math.floor(Date.now()/1000);if(!p||!googleIssuers.has(p.iss)||p.aud!==config.audience||p.email_verified!==true||p.email!==config.controllerPrincipal||!p.sub||!Number.isSafeInteger(p.exp)||p.exp<=now||!Number.isSafeInteger(p.iat)||p.iat>now+30)throw Error('Verified exact controller service account required');return{verified:true,audience:config.audience,principal:p.email};};
}
/** ADC ID-token issuance for this fixed audience, not access-token bearer and
 * not SA impersonation. Only usable after approved narrow runtime attachment.
 */
export function googleCatalogueIdTokenProvider(config:{audience:string},auth:Pick<GoogleAuth,'getIdTokenClient'>=new GoogleAuth()){if(!/^https:\/\/[^/]+$/.test(config.audience))throw Error('Exact worker audience required');return async(audience:string)=>{if(audience!==config.audience)throw Error('Unexpected token audience');const client=await auth.getIdTokenClient(audience);return client.idTokenProvider.fetchIdToken(audience);};}

import {PANEL_PILOT_EMAIL,authenticateCataloguePanel} from '../../lib/catalogue-panel-identity.js';
import {onCall,onRequest,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {OAuth2Client} from 'google-auth-library';
import {z} from 'zod';
import {extractUser,assertRole} from '../../middleware/auth.js';
import {cataloguePanelStore,panelSaveSchema} from '../../lib/catalogue-panel-store.js';
import {enforceRateLimit,subjectFrom} from '../../middleware/rateLimit.js';
import {CATALOGUE_PANEL_QUALIFIED as ENABLED,panelServiceIds} from '../../lib/catalogue-panel-gate.js';
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const input=z.discriminatedUnion('operation',[z.object({operation:z.literal('read'),serviceId:id}).strict(),panelSaveSchema.extend({operation:z.literal('save')}).strict(),z.object({operation:z.literal('status'),operationId:id}).strict()]);
export async function panelRequest(actor:{uid:string;tenantId:string;role:string},data:unknown){if(!ENABLED)throw new HttpsError('failed-precondition','Sheet panel is not activated. Nothing changed.');const p=input.parse(data);const ids=panelServiceIds();const store=cataloguePanelStore(getFirestore(),actor,ids);if(p.operation==='read')return store.read(p.serviceId);if(p.operation==='status')return store.status(p.operationId);const{operation:_,...save}=p;return store.save(save);}
/** Not exported from index.ts. Admin and sidebar share panelRequest/store. */
export const manageCataloguePanelDraft=onCall({region:'asia-south1',enforceAppCheck:true},async request=>{const user=extractUser(request);assertRole(user,'admin','superadmin');if(user.email!==PANEL_PILOT_EMAIL)throw new HttpsError('permission-denied','Pilot owner required');await enforceRateLimit(subjectFrom(user),'service.update');return panelRequest({uid:user.uid,tenantId:user.claims.tenantId,role:user.claims.role},request.data)});
/** Server-to-server bridge for a container-bound Apps Script. The ID token is
 * minted per request, never placed in cells, HTML, browser storage or logs.
 * Exact audience + verified Google provider identity + current Firebase role. */
export const catalogueSheetPanelBridge=onRequest({region:'asia-south1',cors:false,minInstances:0,maxInstances:1,concurrency:1,timeoutSeconds:30},async(req,res)=>{res.set('Cache-Control','no-store');if(!ENABLED){res.status(503).json({error:'Panel is not activated'});return;}try{if(req.method!=='POST')throw Error('Post required');const audience=process.env['CATALOGUE_PANEL_GOOGLE_AUDIENCE'];if(!audience)throw Error('Audience not configured');const auth=req.get('authorization')??'';if(!auth.startsWith('Bearer '))throw Error('Identity required');const actor=await authenticateCataloguePanel(auth.slice(7),audience,{verify:async(token,aud)=>(await new OAuth2Client().verifyIdToken({idToken:token,audience:aud})).getPayload(),lookup:async(email)=>getAuth().getUserByEmail(email)});await enforceRateLimit(actor,'service.update');res.json(await panelRequest(actor,req.body));}catch{res.status(409).json({error:'Could not confirm this draft operation. Reload or check its status; do not repeat an unknown save.'});}});

export const PANEL_PILOT_EMAIL='autodeckstudio@gmail.com';
export type PanelGoogleIdentity={email?:string;email_verified?:boolean;sub?:string};
export type PanelFirebaseIdentity={uid:string;disabled:boolean;providerData:{providerId:string;uid:string}[];customClaims?:Record<string,unknown>};
/** Resolve every bridge request against a freshly verified token and current user.
 * Local tests inject only the network boundary. No email alone grants access. */
export async function authenticateCataloguePanel(token:string,audience:string,deps:{verify:(token:string,audience:string)=>Promise<PanelGoogleIdentity|undefined>;lookup:(email:string)=>Promise<PanelFirebaseIdentity>}):Promise<{uid:string;role:'admin'|'superadmin';tenantId:string}>{
 if(!token||!audience)throw Error('Identity configuration required');
 const p=await deps.verify(token,audience);
 if(!p?.email_verified||p.email!==PANEL_PILOT_EMAIL||!p.sub)throw Error('Verified Google identity required');
 const user=await deps.lookup(p.email),c=user.customClaims??{};
 if(user.disabled||!user.providerData.some(d=>d.providerId==='google.com'&&d.uid===p.sub))throw Error('Bound Google identity required');
 if((c['role']!=='admin'&&c['role']!=='superadmin')||c['tenantId']!=='automodz')throw Error('Catalogue admin required');
 return{uid:user.uid,role:c['role'],tenantId:String(c['tenantId'])};
}

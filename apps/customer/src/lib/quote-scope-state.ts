/** Scope key changes on sign-out, profile switch or tenant switch. Never retain another profile's request cards. */
import{listOwnerKey}from'./owner-key';
export function quoteOwnerScope(auth:{status:string;user?:{uid:string};customerDocId?:string|null;customerDocResolution?:string;claims?:{tenantId:string;role?:'customer'|'studio'|'admin'|'superadmin'|'accountant'}}):string|null{if(auth.status!=='ready'||!auth.claims)return null;const k=listOwnerKey(auth);return k?`${auth.claims.tenantId}:${k.key}`:null}

/** Scope key changes on sign-out, profile switch or tenant switch. Never retain another profile's request cards. */
export function quoteOwnerScope(auth:{status:string;customerDocId?:string|null;claims?:{tenantId:string}}):string|null{return auth.status==='ready'&&auth.customerDocId&&auth.claims?`${auth.claims.tenantId}:${auth.customerDocId}`:null}

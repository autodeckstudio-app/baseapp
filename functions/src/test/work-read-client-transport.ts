// Test-only callable transport into real handlers/Firestore; not HTTP/auth/AppCheck proof.
export const httpsCallable=(_f:unknown,name:string,options:unknown)=>async(data:unknown)=>{const fn=(globalThis as any).__workReadTransport;if(!fn)throw Error('Work read transport missing');return fn(name,options,data)};

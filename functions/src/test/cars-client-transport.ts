// Test-only transport seam. The real client adapter serializes into real handlers + Firestore emulator. Not an HTTP/auth/AppCheck proof.
export const httpsCallable=(_f:unknown,name:string,options:unknown)=>async(data:unknown)=>{const fn=(globalThis as any).__carsClientTransport;if(!fn)throw Error('Emulator client transport is not installed');return fn(name,options,data)};

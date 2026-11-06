import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
/** Short-lived reads only. Ownership and tenant checks remain on the server. */
export async function readPrivatePhoto(kind:'license'|'vehiclePhoto',id:string,path?:string):Promise<string>{
 const reply=await httpsCallable<{kind:'license'|'vehiclePhoto';id:string;path?:string},{url:string}>(functions,'getPrivateFileUrl')({kind,id,...(path?{path}:{})});
 if(!reply.data.url)throw new Error('The saved photo could not be opened.');
 return reply.data.url;
}
export function isMissingPrivatePhoto(error:unknown):boolean{return (error as {code?:string}|null)?.code==='functions/not-found';}

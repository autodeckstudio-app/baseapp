import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
type Kind='license'|'vehiclePhoto';
type Entry={until:number;pending:Promise<string>};
const photos=new Map<string,Entry>();
let session:object|null=null,credential:string|null=null;
/** In-memory vehicle reads only. No licence cache, disk storage or signed URL rewriting.
 * Token/session changes discard the cache; expiry and explicit image retry re-authorize on the server. */
export async function readPrivatePhoto(kind:Kind,id:string,path?:string,refresh=false,version?:string|null):Promise<string>{
 const user=auth.currentUser;
 const token=user?await user.getIdToken():null;
 if(auth.currentUser!==user)throw new Error('Photo session changed.');
 if(session!==user||credential!==token){photos.clear();session=user;credential=token;}
 const key=JSON.stringify([kind,id,path??null,version??null]);
 const cacheable=kind==='vehiclePhoto'&&!!user&&!!token;
 const hit=photos.get(key);
 if(cacheable&&!refresh&&hit&&hit.until>Date.now())return hit.pending;
 const entry:Entry={until:Date.now()+120000,pending:Promise.resolve('')};
 entry.pending=(async()=>{
  try{
   const reply=await httpsCallable<{kind:Kind;id:string;path?:string},{url:string;expiresInSeconds?:number}>(functions,'getPrivateFileUrl')({kind,id,...(path?{path}:{})});
   if(auth.currentUser!==user||session!==user||credential!==token)throw new Error('Photo session changed.');
   if(!reply.data.url)throw new Error('The saved photo could not be opened.');
   // Conservatively expire well before the signed URL; an absent TTL is not cache permission.
   entry.until=Date.now()+Math.max(0,Math.min(120000,((reply.data.expiresInSeconds??0)-60)*1000));
   return reply.data.url;
  }catch(error){if(photos.get(key)===entry)photos.delete(key);throw error;}
 })();
 if(cacheable){if(photos.size>=64)photos.delete(photos.keys().next().value!);photos.set(key,entry);}
 return entry.pending;
}
export function isMissingPrivatePhoto(error:unknown):boolean{return (error as {code?:string}|null)?.code==='functions/not-found';}

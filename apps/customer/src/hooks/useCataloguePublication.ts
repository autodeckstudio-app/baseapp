import{useEffect,useRef,useState}from'react';
import{doc,onSnapshot}from'firebase/firestore';
import{db}from'../lib/firebase';
import{useAuth}from'./useAuth';
import{invalidateCatalogueDisplayReads}from'../lib/catalogue-service';
/** Push-only version signal, no polling. Each update invalidates the whole
 * display read before subscribers fetch a coherent new snapshot. Offline and
 * listener errors are not claims that this device has the latest publication. */
export function useCataloguePublication(onChange?:()=>void){
 const auth=useAuth(),[revision,setRevision]=useState(0),latest=useRef(onChange);latest.current=onChange;
 const scope=auth.status==='ready'?`${auth.user.uid}|${auth.claims.tenantId}`:'';
 useEffect(()=>{if(auth.status!=='ready'||!scope)return;let alive=true,version:string|undefined;const stop=onSnapshot(doc(db,'cataloguePublishedVersions',auth.claims.tenantId),snapshot=>{if(!alive||snapshot.metadata.fromCache)return;const next=snapshot.exists()?snapshot.data()['publishId'] as string:undefined;if(next===version)return;version=next;invalidateCatalogueDisplayReads();setRevision(n=>n+1);latest.current?.()},()=>{/* Existing scoped reads retain their explicit error handling. */});return()=>{alive=false;stop()};},[scope]);
 return revision;
}

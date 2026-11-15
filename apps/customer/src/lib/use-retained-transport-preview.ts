import{useEffect,useState}from'react';
import{doc,onSnapshot}from'firebase/firestore';
import{httpsCallable}from'firebase/functions';
import{watchCompleteRetainedTransportRows,type RetainedTransportList,type RetainedWatchState}from'@autodeck/core';
/** Explicit demo-only build. Every use still verifies all actual SDK targets. */
export const RETAINED_TRANSPORT_PREVIEW=process.env.EXPO_PUBLIC_RETAINED_TRANSPORT_PREVIEW==='true'&&process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.startsWith('demo-')===true&&process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR==='true';
export function useRetainedTransportPreview(scope:string|null,ids:readonly string[]|null):RetainedWatchState<RetainedTransportList>{
 const key=RETAINED_TRANSPORT_PREVIEW&&scope&&ids?JSON.stringify([scope,ids]):null;
 const[state,setState]=useState<{key:string;value:RetainedWatchState<RetainedTransportList>}|null>(null);
 useEffect(()=>{setState(null);if(!key||!ids)return;let alive=true;let stop:(()=>void)|undefined;
  void import('./firebase').then(({auth,db,functions})=>{
   if(!alive)return;
   if(!auth.app.options.projectId?.startsWith('demo-')||!(db as any)._settings?.host?.match(/^(localhost|127\.0\.0\.1):[0-9]+$/)||!(functions as any).emulatorOrigin?.match(/^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/)||!auth.emulatorConfig)throw Error('Local preview unavailable.');
   const read=async(requestIds:readonly string[])=>{if(!alive)throw Error('Expired preview.');return(await httpsCallable(functions,'getRetainedTransportList')({requestIds})).data;};
   stop=watchCompleteRetainedTransportRows(ids,{read,waitForInitialSources:true,subscribe:(kind,id,change,error)=>onSnapshot(doc(db,kind==='request'?'pickupRequests':'bookings',id),()=>change(),()=>error())},value=>{if(alive)setState({key,value})});
  }).catch(()=>{if(alive)setState({key,value:{status:'unavailable'}})});

  return()=>{alive=false;stop?.()};
 },[key]);
 return key&&state?.key===key?state.value:{status:'loading'};
}

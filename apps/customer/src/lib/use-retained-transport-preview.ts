import{useEffect,useState}from'react';
import{doc,onSnapshot}from'firebase/firestore';
import{httpsCallable}from'firebase/functions';
import{watchCompleteRetainedTransportRows,type RetainedTransportList,type RetainedWatchState}from'@autodeck/core';
import{CONNECTED_VISIT_ENABLED,assertConnectedVisitTarget}from'./connected-visit-release';
// Compatibility alias for the existing mounted controls.
export const RETAINED_TRANSPORT_PREVIEW=CONNECTED_VISIT_ENABLED;
export function useRetainedTransportPreview(scope:string|null,ids:readonly string[]|null):RetainedWatchState<RetainedTransportList>{
 const key=RETAINED_TRANSPORT_PREVIEW&&scope&&ids?JSON.stringify([scope,ids]):null;
 const[state,setState]=useState<{key:string;value:RetainedWatchState<RetainedTransportList>}|null>(null);
 useEffect(()=>{setState(null);if(!key||!ids)return;let alive=true;let stop:(()=>void)|undefined;
  void import('./firebase').then(({auth,db,functions})=>{
   if(!alive)return;
   assertConnectedVisitTarget({auth,db,functions});
   const read=async(requestIds:readonly string[])=>{if(!alive)throw Error('Expired preview.');return(await httpsCallable(functions,'getRetainedTransportList')({requestIds})).data;};
   stop=watchCompleteRetainedTransportRows(ids,{read,waitForInitialSources:true,subscribe:(kind,id,change,error)=>onSnapshot(doc(db,kind==='request'?'pickupRequests':'bookings',id),()=>change(),()=>error())},value=>{if(alive)setState({key,value})});
  }).catch(()=>{if(alive)setState({key,value:{status:'unavailable'}})});

  return()=>{alive=false;stop?.()};
 },[key]);
 return key&&state?.key===key?state.value:{status:'loading'};
}

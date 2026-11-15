import{useEffect,useState}from'react';
import type{RetainedWatchPort,RetainedWatchState}from'@autodeck/core';
import{listenToVerifiedRetainedTransport}from'./retained-transport-watch';
/** DORMANT actual data hook. No screen imports it; no implicit activation.
 * Scope must include verified uid/role/tenant/studio. Null signs out. */
export function useRetainedTransport<T>(scope:string|null,requestIds:readonly string[],reader:Pick<RetainedWatchPort<T>,'read'|'validate'>,enabled=false):RetainedWatchState<T>{
 const key=enabled&&scope?JSON.stringify([scope,requestIds]):null;
 const[state,setState]=useState<{key:string;reader:typeof reader;value:RetainedWatchState<T>}|null>(null);
 useEffect(()=>{setState(null);if(!key)return;let alive=true;let stop:(()=>void)|undefined;
  try{stop=listenToVerifiedRetainedTransport(requestIds,reader,value=>{if(alive)setState({key,reader,value})});}catch{setState({key,reader,value:{status:'unavailable'}});}
  return()=>{alive=false;stop?.()};
 },[key,reader]);
 if(!key)return{status:'unavailable'};
 return state?.key===key&&state.reader===reader?state.value:{status:'loading'};
}

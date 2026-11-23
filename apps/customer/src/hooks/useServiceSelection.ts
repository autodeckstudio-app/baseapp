import{useEffect,useSyncExternalStore}from'react';
import{useAuth}from'./useAuth';
import{listOwnerKey}from'../lib/owner-key';
import{serviceSelection,selectionOwnerKey}from'../lib/booking-selection';
export function useServiceSelection(){const auth=useAuth(),owner=listOwnerKey(auth);const scope=selectionOwnerKey(auth.status==='ready'&&owner?{uid:auth.user.uid,tenantId:auth.claims.tenantId,customerId:owner.key}:null);useEffect(()=>{serviceSelection.bind(scope)},[scope]);const ids=useSyncExternalStore(serviceSelection.subscribe,()=>serviceSelection.read(scope),()=>serviceSelection.read(null));return{ids,scope,toggle:(id:string)=>serviceSelection.toggle(scope,id),clear:()=>serviceSelection.clear(scope)}}

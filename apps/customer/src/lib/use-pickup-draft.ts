import{useCallback,useSyncExternalStore}from'react';
import{readPickupDraft,subscribePickupDraft,updatePickupDraft,type PickupDraft}from'./pickup-draft';
export function usePickupDraft(scope:string|null){const read=useCallback(()=>readPickupDraft(scope),[scope]);const draft=useSyncExternalStore(subscribePickupDraft,read,read);const update=useCallback((patch:Partial<PickupDraft>)=>updatePickupDraft(scope,patch),[scope]);return{draft,update};}

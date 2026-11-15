import{doc,onSnapshot}from'firebase/firestore';
import{COLLECTIONS}from'@autodeck/database';
import{parseRetainedTransportBatch,watchRetainedTransportRows,type RetainedWatchPort,type RetainedWatchState}from'@autodeck/core';
import{db}from'./firebase';
/** DORMANT concrete Firebase invalidation adapter. No screen imports it.
 * Caller must key lifetime by verified principal/tenant/studio/request scope,
 * stop the old scope before replacing it, and supply authenticated batch read
 * plus strict response validation. No missing-callable fallback or UI enabling.
 * Physical data always comes from the server read, never a revision signal. */
export function listenToVerifiedRetainedTransport<T>(requestIds:readonly string[],reader:Pick<RetainedWatchPort<T>,'read'|'validate'>,onState:(state:RetainedWatchState<T>)=>void){
 return watchRetainedTransportRows(requestIds,{...reader,subscribe:(kind,id,change,error)=>onSnapshot(doc(db,kind==='request'?COLLECTIONS.pickupRequests():COLLECTIONS.bookings(),id),()=>change(),()=>error())},onState);
}

/** Typed inactive integration for the real retained batch contract. Transport
 * remains explicit/injected until coordinated authenticated route activation. */
export function retainedTransportBatchReader(read:(requestIds:readonly string[])=>Promise<unknown>){
 return{read,validate:parseRetainedTransportBatch};
}

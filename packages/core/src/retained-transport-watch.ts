/** Dormant data lifecycle, not a physical-state validator or action grant.
 * Adapters supply an authenticated batch reader plus strict response validator.
 * A ready snapshot is discarded as soon as either source invalidates it. */
export type RetainedWatchState<T>={status:'loading'}|{status:'unavailable'}|{status:'ready';data:T};
export type RetainedWatchPort<T>={
 subscribe:(kind:'request'|'booking',requestId:string,change:()=>void,error:()=>void)=>()=>void;
 read:(requestIds:readonly string[])=>Promise<unknown>;
 validate:(raw:unknown,requestIds:readonly string[])=>T;
};
export function watchRetainedTransportRows<T>(requestIds:readonly string[],port:RetainedWatchPort<T>,emit:(state:RetainedWatchState<T>)=>void){
 if(!requestIds.length||requestIds.length>20||new Set(requestIds).size!==requestIds.length||requestIds.some(id=>!/^[A-Za-z0-9_-]{1,120}$/.test(id)))throw Error('Exact journey rows required.');
 const ids=[...requestIds];let active=true,generation=0,installing=true,failed=false;const stops:(()=>void)[]=[];
 const publish=(state:RetainedWatchState<T>)=>{if(active)emit(state)};
 const refresh=()=>{if(!active||failed)return;const token=++generation;publish({status:'loading'});if(installing)return;
  // Catch both synchronous reader/validator errors and asynchronous rejection.
  Promise.resolve().then(()=>{if(!active||failed||token!==generation)return undefined;return port.read(ids)}).then(raw=>{if(!active||failed||token!==generation)return;publish({status:'ready',data:port.validate(raw,ids)})}).catch(()=>{if(active&&!failed&&token===generation)publish({status:'unavailable'})});
 };
 const sourceError=()=>{if(!active)return;failed=true;generation++;publish({status:'unavailable'});};
 publish({status:'loading'});
 try{for(const id of ids)for(const kind of['request','booking']as const){if(failed)break;stops.push(port.subscribe(kind,id,refresh,sourceError));}}catch{sourceError();}
 installing=false;if(!failed)refresh();
 return()=>{if(!active)return;active=false;generation++;for(const stop of stops){try{stop()}catch{/* release all listeners even if one cleanup throws */}}};
}

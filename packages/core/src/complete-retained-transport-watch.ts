import{watchRetainedTransportRows,type RetainedWatchPort,type RetainedWatchState}from'./retained-transport-watch.js';
import{parseRetainedTransportList,type RetainedTransportList}from'./retained-transport-read.js';
/** Discovery is a complete, uncapped scoped Firestore snapshot supplied by the
 * app. Chunk every discovered identity, not just the first20. No ready rows or
 * counts escape until EVERY chunk is verified. Existing per-chunk listeners
 * install before fetch; each invalidation immediately drops aggregate ready. */
export function watchCompleteRetainedTransportRows(ids:readonly string[],port:Omit<RetainedWatchPort<RetainedTransportList>,'validate'>,emit:(state:RetainedWatchState<RetainedTransportList>)=>void){
 if(new Set(ids).size!==ids.length||ids.some(id=>!/^[A-Za-z0-9_-]{1,120}$/.test(id)))throw Error('Exact discovered rows required.');
 if(!ids.length){emit({status:'ready',data:{batch:{rows:[]},bookings:[]}});return()=>{};}
 let active=true,installing=true;const chunks:RetainedWatchState<RetainedTransportList>[]=[],stops:(()=>void)[]=[];
 const publish=()=>{if(!active||installing)return;if(chunks.some(c=>c.status==='unavailable')){emit({status:'unavailable'});return;}if(chunks.length!==Math.ceil(ids.length/20)||chunks.some(c=>c.status!=='ready')){emit({status:'loading'});return;}
 const values=chunks.map(c=>(c as Extract<typeof c,{status:'ready'}>).data);emit({status:'ready',data:{batch:{rows:values.flatMap(v=>v.batch.rows)},bookings:values.flatMap(v=>v.bookings)}});};
 emit({status:'loading'});
 try{for(let i=0;i<ids.length;i+=20){const n=i/20;chunks[n]={status:'loading'};stops.push(watchRetainedTransportRows(ids.slice(i,i+20),{...port,validate:parseRetainedTransportList},state=>{chunks[n]=state;publish()}));}}catch{chunks.push({status:'unavailable'});}
 installing=false;publish();return()=>{active=false;stops.forEach(stop=>stop());};
}

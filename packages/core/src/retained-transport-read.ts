export type RetainedTransportPhysical={visitId:string;jobId:string;requestId:string;originalRequestStatus:'REQUESTED'|'CONFIRMED'|'DONE';physicalState:'open'|'completed'|'closed_unused';placement:'active'|'history';neededLegs:('pickup'|'drop')[];completedLegs:('pickup'|'drop')[];unusedLegs:('pickup'|'drop')[];requiresExplicitUnusedClosure:boolean;pickupCompletedAt:string|null;dropCompletedAt:string|null};
export type RetainedTransportBatch={rows:({requestId:string;kind:'legacy'}|{requestId:string;kind:'retained';physical:RetainedTransportPhysical})[]};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v),id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const exact=(v:Record<string,any>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=():never=>{throw Error('Verified journey rows unavailable.');};
/** Exact response allowlist. A valid read is not permission to act. Reject
 * extra/private fields, partial/reordered results and inconsistent physical
 * histories. Never downgrade malformed retained rows into legacy or empty. */
export function parseRetainedTransportBatch(raw:unknown,requestIds:readonly string[]):RetainedTransportBatch{
 if(!requestIds.length||requestIds.length>20||requestIds.some(v=>!id(v))||new Set(requestIds).size!==requestIds.length||!object(raw)||!exact(raw,['rows'])||!Array.isArray(raw.rows)||raw.rows.length!==requestIds.length)return fail();
 const rows:RetainedTransportBatch['rows']=[];
 for(const[index,row]of raw.rows.entries()){
  if(!object(row)||row.requestId!==requestIds[index])return fail();
  if(row.kind==='legacy'){if(!exact(row,['requestId','kind']))return fail();rows.push({requestId:row.requestId,kind:'legacy'});continue;}
  if(row.kind!=='retained'||!exact(row,['requestId','kind','physical'])||!object(row.physical))return fail();
  const p=row.physical,keys=['visitId','jobId','requestId','originalRequestStatus','physicalState','placement','neededLegs','completedLegs','unusedLegs','requiresExplicitUnusedClosure','pickupCompletedAt','dropCompletedAt'];
  if(!exact(p,keys)||![p.visitId,p.jobId,p.requestId].every(id)||p.requestId!==row.requestId||!['REQUESTED','CONFIRMED','DONE'].includes(p.originalRequestStatus)||!['open','completed','closed_unused'].includes(p.physicalState)||typeof p.requiresExplicitUnusedClosure!=='boolean')return fail();
  const groups=[p.neededLegs,p.completedLegs,p.unusedLegs];
  if(groups.some(a=>!Array.isArray(a)||a.length>2||a.some((v:unknown)=>!['pickup','drop'].includes(v as string))||new Set(a).size!==a.length))return fail();
  const all=groups.flat();if(!all.length||new Set(all).size!==all.length||all.length>2)return fail();
  for(const leg of['pickup','drop']){const at=p[leg+'CompletedAt'];if(!(at===null||typeof at==='string'&&Number.isFinite(Date.parse(at)))||p.completedLegs.includes(leg)!==(typeof at==='string'))return fail();}
  if(p.physicalState==='open'){
   if(p.placement!=='active'||p.originalRequestStatus==='DONE'||p.requiresExplicitUnusedClosure!==(p.unusedLegs.length>0))return fail();
  }else if(p.physicalState==='completed'){
   if(p.placement!=='history'||p.originalRequestStatus!=='DONE'||p.neededLegs.length||p.unusedLegs.length||!p.completedLegs.length||p.requiresExplicitUnusedClosure)return fail();
  }else if(p.placement!=='history'||p.originalRequestStatus==='DONE'||p.neededLegs.length||!p.unusedLegs.length||p.requiresExplicitUnusedClosure)return fail();
  rows.push({requestId:row.requestId,kind:'retained',physical:{visitId:p.visitId,jobId:p.jobId,requestId:p.requestId,originalRequestStatus:p.originalRequestStatus,physicalState:p.physicalState,placement:p.placement,neededLegs:[...p.neededLegs],completedLegs:[...p.completedLegs],unusedLegs:[...p.unusedLegs],requiresExplicitUnusedClosure:p.requiresExplicitUnusedClosure,pickupCompletedAt:p.pickupCompletedAt,dropCompletedAt:p.dropCompletedAt}});
 }
 return{rows};
}

export type RetainedTransportList={batch:RetainedTransportBatch;bookings:{requestId:string;status:string}[]};
/** Same transaction's minimal booking status. No private booking/finance fields. */
export function parseRetainedTransportList(raw:unknown,ids:readonly string[]):RetainedTransportList{
 if(!object(raw)||!exact(raw,['batch','bookings'])||!Array.isArray(raw.bookings)||raw.bookings.length!==ids.length)return fail();
 const batch=parseRetainedTransportBatch(raw.batch,ids),bookings=raw.bookings.map((b:unknown,i:number)=>{
  if(!object(b)||!exact(b,['requestId','status'])||b.requestId!==ids[i]||!['PENDING','CONFIRMED','ACTIVE','COMPLETED','CANCELLED','EXPIRED'].includes(b.status))return fail();
  return{requestId:b.requestId as string,status:b.status as string};
 });return{batch,bookings};
}

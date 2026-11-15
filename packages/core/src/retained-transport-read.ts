export type RetainedTransportPhysical={visitId:string;jobId:string;requestId:string;originalRequestStatus:'REQUESTED'|'CONFIRMED'|'DONE';physicalState:'open'|'completed'|'closed_unused';placement:'active'|'history';neededLegs:('pickup'|'drop')[];completedLegs:('pickup'|'drop')[];unusedLegs:('pickup'|'drop')[];requiresExplicitUnusedClosure:boolean;pickupCompletedAt:string|null;dropCompletedAt:string|null};
export type RetainedTransportBatch={rows:({requestId:string;kind:'legacy'}|{requestId:string;kind:'retained';physical:RetainedTransportPhysical})[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=():never=>{throw Error('Verified journey rows unavailable.');};
const oneOf=<T extends string>(value:unknown,values:readonly T[]):value is T=>typeof value==='string'&&values.some(v=>v===value);
const legs=(value:unknown):value is ('pickup'|'drop')[]=>Array.isArray(value)&&value.length<=2&&value.every(v=>oneOf(v,['pickup','drop']))&&new Set(value).size===value.length;
const instant=(value:unknown):value is string|null=>value===null||typeof value==='string'&&Number.isFinite(Date.parse(value));
/** Exact response allowlist. A valid read is not permission to act. Reject
 * extra/private fields, partial/reordered results and inconsistent physical
 * histories. Never downgrade malformed retained rows into legacy or empty. */
export function parseRetainedTransportBatch(raw:unknown,requestIds:readonly string[]):RetainedTransportBatch{
 if(!requestIds.length||requestIds.length>20||requestIds.some(v=>!id(v))||new Set(requestIds).size!==requestIds.length||!object(raw)||!exact(raw,['rows'])||!Array.isArray(raw.rows)||raw.rows.length!==requestIds.length)return fail();
 const rows:RetainedTransportBatch['rows']=[];
 for(const[index,row]of raw.rows.entries()){
  if(!object(row)||!id(row.requestId)||row.requestId!==requestIds[index])return fail();
  if(row.kind==='legacy'){if(!exact(row,['requestId','kind']))return fail();rows.push({requestId:row.requestId,kind:'legacy'});continue;}
  if(row.kind!=='retained'||!exact(row,['requestId','kind','physical'])||!object(row.physical))return fail();
  const p=row.physical,keys=['visitId','jobId','requestId','originalRequestStatus','physicalState','placement','neededLegs','completedLegs','unusedLegs','requiresExplicitUnusedClosure','pickupCompletedAt','dropCompletedAt'];
  if(!exact(p,keys)||!id(p.visitId)||!id(p.jobId)||!id(p.requestId)||p.requestId!==row.requestId||!oneOf(p.originalRequestStatus,['REQUESTED','CONFIRMED','DONE'])||!oneOf(p.physicalState,['open','completed','closed_unused'])||typeof p.requiresExplicitUnusedClosure!=='boolean'||!legs(p.neededLegs)||!legs(p.completedLegs)||!legs(p.unusedLegs)||!instant(p.pickupCompletedAt)||!instant(p.dropCompletedAt))return fail();
  const all=[...p.neededLegs,...p.completedLegs,...p.unusedLegs];if(!all.length||new Set(all).size!==all.length||all.length>2)return fail();
  if(p.completedLegs.includes('pickup')!==(typeof p.pickupCompletedAt==='string')||p.completedLegs.includes('drop')!==(typeof p.dropCompletedAt==='string'))return fail();
  if(p.physicalState==='open'){
   if(p.placement!=='active'||p.originalRequestStatus==='DONE'||p.requiresExplicitUnusedClosure!==(p.unusedLegs.length>0))return fail();
  }else if(p.physicalState==='completed'){
   if(p.placement!=='history'||p.originalRequestStatus!=='DONE'||p.neededLegs.length||p.unusedLegs.length||!p.completedLegs.length||p.requiresExplicitUnusedClosure)return fail();
  }else if(p.placement!=='history'||p.originalRequestStatus==='DONE'||p.neededLegs.length||!p.unusedLegs.length||p.requiresExplicitUnusedClosure)return fail();
  rows.push({requestId:row.requestId,kind:'retained',physical:{visitId:p.visitId,jobId:p.jobId,requestId:p.requestId,originalRequestStatus:p.originalRequestStatus,physicalState:p.physicalState,placement:p.physicalState==='open'?'active':'history',neededLegs:[...p.neededLegs],completedLegs:[...p.completedLegs],unusedLegs:[...p.unusedLegs],requiresExplicitUnusedClosure:p.requiresExplicitUnusedClosure,pickupCompletedAt:p.pickupCompletedAt,dropCompletedAt:p.dropCompletedAt}});
 }
 return{rows};
}
export type RetainedTransportList={batch:RetainedTransportBatch;bookings:{requestId:string;status:string}[]};
/** Same transaction's minimal booking status. No private booking/finance fields. */
export function parseRetainedTransportList(raw:unknown,ids:readonly string[]):RetainedTransportList{
 if(!object(raw)||!exact(raw,['batch','bookings'])||!Array.isArray(raw.bookings)||raw.bookings.length!==ids.length)return fail();
 const batch=parseRetainedTransportBatch(raw.batch,ids),bookings=raw.bookings.map((b:unknown,i:number)=>{
  if(!object(b)||!exact(b,['requestId','status'])||!id(b.requestId)||b.requestId!==ids[i]||!oneOf(b.status,['PENDING','CONFIRMED','ACTIVE','COMPLETED','CANCELLED','EXPIRED']))return fail();
  return{requestId:b.requestId,status:b.status};
 });return{batch,bookings};
}

import { describe, it, expect } from 'vitest';
import { getFirestore } from 'firebase-admin/firestore';
import { markAttendance } from '../../functions/attendance/markAttendance.js';
import { checkInAttendance } from '../../functions/attendance/checkInAttendance.js';
import { startAttendanceBreak } from '../../functions/attendance/startAttendanceBreak.js';
import { endAttendanceBreak } from '../../functions/attendance/endAttendanceBreak.js';
import { checkOutAttendance } from '../../functions/attendance/checkOutAttendance.js';
import { utcToLocalDate } from '../../lib/schedule.js';
const db=getFirestore(); let n=0;
async function setup() {
 const id=`independent-${Date.now()}-${n++}`,tenantId='review-tenant',studioId='review-studio';
 const auth={uid:id,token:{role:'studio',tenantId,studioId}};
 const admin={uid:'review-admin',token:{role:'admin',tenantId,studioId:null}};
 await db.collection('employees').doc(id).set({id,authUid:id,tenantId,studioId,active:true});
 const date=utcToLocalDate(new Date(),'Asia/Kolkata'); const docId=`${tenantId}__${id}__${date}`;
 await markAttendance.run({data:{employeeId:id,date,status:'PRESENT',notes:'Office history'},auth:admin} as never);
 return {id,auth,admin,date,ref:db.collection('attendance').doc(docId)};
}
describe('independent attendance review',()=> {
 it('preserves original metadata and audit, then completes self break/checkout with valid minutes',async()=>{
  const f=await setup(); const before=(await f.ref.get()).data()!;
  await checkInAttendance.run({data:{},auth:f.auth} as never);
  const after=(await f.ref.get()).data()!;
  for(const key of ['createdAt','tenantId','studioId','employeeId','employeeAuthUid','date','status','notes','breaks','workedMinutes','checkOutAt']) expect(after[key]).toEqual(before[key]);
  expect(after.markedBy).toBe(f.id);
  const audit=await db.collection('auditLog').where('entityId','==',f.ref.id).get();
  expect(audit.docs.map(d=>d.data().action).sort()).toEqual(['attendance.checked_in','attendance.marked']);
  await startAttendanceBreak.run({data:{},auth:f.auth} as never);
  await endAttendanceBreak.run({data:{},auth:f.auth} as never);
  const out=await checkOutAttendance.run({data:{},auth:f.auth} as never) as {workedMinutes:number};
  expect(Number.isFinite(out.workedMinutes)).toBe(true); expect(out.workedMinutes).toBeGreaterThanOrEqual(0);
  await expect(checkInAttendance.run({data:{},auth:f.auth} as never)).rejects.toMatchObject({code:'already-exists'});
 });
 it('accepts explicit new notes while retaining createdAt',async()=>{
  const f=await setup(); const before=(await f.ref.get()).data()!;
  await checkInAttendance.run({data:{notes:'Staff note'},auth:f.auth} as never);
  expect((await f.ref.get()).data()).toMatchObject({notes:'Staff note',createdAt:before.createdAt});
 });
 it.each([{checkOutAt:'2026-10-27T12:00:00Z'},{breaks:[{startedAt:'2026-10-27T12:00:00Z',endedAt:null}]},{breaks:[{startedAt:'2026-10-27T12:00:00Z',endedAt:'2026-10-27T12:10:00Z'}]}])('does not overwrite anomalous prior activity %j',async(delta)=>{
  const f=await setup(); await f.ref.update(delta); const before=(await f.ref.get()).data();
  await expect(checkInAttendance.run({data:{},auth:f.auth} as never)).rejects.toMatchObject({code:'already-exists'});
  expect((await f.ref.get()).data()).toEqual(before);
 });
});

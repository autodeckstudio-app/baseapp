import { describe, it, expect } from 'vitest';
import { getFirestore } from 'firebase-admin/firestore';
import { markAttendance } from '../../functions/attendance/markAttendance.js';
import { checkInAttendance } from '../../functions/attendance/checkInAttendance.js';
import { startAttendanceBreak } from '../../functions/attendance/startAttendanceBreak.js';
import { endAttendanceBreak } from '../../functions/attendance/endAttendanceBreak.js';
import { checkOutAttendance } from '../../functions/attendance/checkOutAttendance.js';
import { utcToLocalDate } from '../../lib/schedule.js';

const db = getFirestore();
let n = 0;
async function fixture() {
  const id = `premark-${Date.now()}-${++n}`;
  const tenantId = 'premark-tenant', studioId = 'premark-studio';
  const auth = { uid: id, token: { role: 'studio', tenantId, studioId } };
  const admin = { uid: 'premark-admin', token: { role: 'admin', tenantId, studioId: null } };
  await db.collection('employees').doc(id).set({ id, authUid: id, tenantId, studioId, active: true });
  const date = utcToLocalDate(new Date(), 'Asia/Kolkata');
  return { id, auth, admin, date, ref: db.collection('attendance').doc(`${tenantId}__${id}__${date}`) };
}
describe('attendance admin mark followed by self check-in', () => {
  it('staff can check in after office has marked PRESENT without times; retry cannot overwrite', async () => {
    const f = await fixture();
    await markAttendance.run({ data: { employeeId: f.id, date: f.date, status: 'PRESENT', notes: 'Office marked presence' }, auth: f.admin } as never);
    expect((await f.ref.get()).data()?.checkInAt).toBeNull();
    const call = () => checkInAttendance.run({ data: {}, auth: f.auth } as never);
    await call();
    const checked = (await f.ref.get()).data()!;
    expect(checked.checkInAt).toBeTruthy();
    expect(checked.notes).toBe('Office marked presence');
    expect(checked.status).toBe('PRESENT');
    await expect(call()).rejects.toMatchObject({ code: 'already-exists' });
    expect((await f.ref.get()).data()?.checkInAt).toBe(checked.checkInAt);
    await startAttendanceBreak.run({ data: {}, auth: f.auth } as never);
    await expect(checkOutAttendance.run({ data: {}, auth: f.auth } as never)).rejects.toMatchObject({ code: 'failed-precondition' });
  });
  it.each(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE'])('no-time %s row cannot start/end a break or check out', async status => {
    const f = await fixture();
    await markAttendance.run({ data: { employeeId: f.id, date: f.date, status }, auth: f.admin } as never);
    for (const fn of [startAttendanceBreak, endAttendanceBreak, checkOutAttendance]) {
      await expect(fn.run({ data: {}, auth: f.auth } as never)).rejects.toMatchObject({ code: 'failed-precondition' });
    }
    expect((await f.ref.get()).data()).toMatchObject({ checkInAt: null, checkOutAt: null, breaks: [], workedMinutes: 0, status });
  });
  it.each(['ABSENT', 'HALF_DAY', 'ON_LEAVE'])('does not override office %s', async status => {
    const f = await fixture();
    await markAttendance.run({ data: { employeeId: f.id, date: f.date, status }, auth: f.admin } as never);
    await expect(checkInAttendance.run({ data: {}, auth: f.auth } as never)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await f.ref.get()).data()).toMatchObject({ status, checkInAt: null });
  });
  it('concurrent check-ins of a premarked row have one winner and one already-exists', async () => {
    const f = await fixture();
    await markAttendance.run({ data: { employeeId: f.id, date: f.date, status: 'PRESENT' }, auth: f.admin } as never);
    const results = await Promise.allSettled([1, 2].map(() => checkInAttendance.run({ data: {}, auth: f.auth } as never)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'already-exists' });
  });

});

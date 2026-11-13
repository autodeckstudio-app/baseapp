import {describe,it,expect} from 'vitest';
import {studioClock,studioOpenStatus} from './studio-clock';
import type {OperatingHours} from './types/studio';
const hours=Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:'10:00',close:'21:00',closed:false})) as OperatingHours[];
describe('studio display clock independent of device timezone',()=>{
 it('uses studio date across the UTC boundary',()=>expect(studioClock(new Date('2026-11-13T19:00:00Z'),'Asia/Kolkata')).toEqual({date:'2026-11-14',day:6,minute:30}));
 it('checks opening and exact closing in the studio zone',()=>{expect(studioOpenStatus(hours,[],'Asia/Kolkata',new Date('2026-11-13T04:30:00Z'))?.open).toBe(true);expect(studioOpenStatus(hours,[],'Asia/Kolkata',new Date('2026-11-13T15:30:00Z'))?.open).toBe(false)});
 it('obeys studio-local holidays rather than UTC date',()=>expect(studioOpenStatus(hours,['2026-11-14'],'Asia/Kolkata',new Date('2026-11-14T05:00:00Z'))?.text).toBe('Closed, opens tomorrow 10 am'));
 it('same instant has different correct open states in two zones',()=>{const now=new Date('2026-11-13T12:00:00Z');expect(studioOpenStatus(hours,[],'Asia/Kolkata',now)?.open).toBe(true);expect(studioOpenStatus(hours,[],'America/Los_Angeles',now)?.open).toBe(false)});
 it('handles DST transitions without offset arithmetic',()=>{expect(studioClock(new Date('2026-11-01T08:30:00Z'),'America/Los_Angeles')?.minute).toBe(90);expect(studioClock(new Date('2026-11-01T09:30:00Z'),'America/Los_Angeles')?.minute).toBe(90)});
 it('invalid or missing zone, corrupt hours and duplicate weekdays make no claim',()=>{for(const zone of[null,undefined,'bad/zone'])expect(studioOpenStatus(hours,[],zone)).toBeNull();expect(studioOpenStatus([{...hours[0]!,open:'25:70'}],[],'UTC')).toBeNull();expect(studioOpenStatus([hours[0]!,hours[0]!],[],'UTC')).toBeNull()});
 it('weekend/year boundary and whole week closure remain deterministic',()=>{expect(studioClock(new Date('2026-12-31T19:00:00Z'),'Asia/Kolkata')?.date).toBe('2027-01-01');expect(studioOpenStatus(hours.map(h=>({...h,closed:true})),[],'UTC')?.text).toBe('Closed')});
});

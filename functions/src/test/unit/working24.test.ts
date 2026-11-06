import {it,expect} from 'vitest';
import {computeScheduleEnd,localToUTC} from '../../lib/schedule';
import {buildOccupiedInterval} from '../../lib/availability';
it('24 working hours crosses nights and closed Sunday, legacy turnover remains separate',()=>{
 const h=Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek:dayOfWeek as 0|1|2|3|4|5|6,open:'10:00',close:'21:00',closed:dayOfWeek===0}));
 const s=localToUTC('2026-11-07','10:00','Asia/Kolkata');
 const end=computeScheduleEnd(s,1440,h,[],'Asia/Kolkata');
 expect(end.toISOString()).toBe('2026-11-10T06:30:00.000Z');
 expect(end.getTime()-s.getTime()).toBeGreaterThan(86400000);
 expect(buildOccupiedInterval(s.toISOString(),end.toISOString()).endAt.getTime()-end.getTime()).toBe(15*60000);
});

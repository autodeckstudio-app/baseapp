import React from 'react';import {act,create} from 'react-test-renderer';import {it,expect,vi,afterEach} from 'vitest';
const h=vi.hoisted(()=>({currentState:'active',events:new Set<(s:string)=>void>()}));
vi.mock('react-native',()=>({AppState:{get currentState(){return h.currentState},addEventListener:(_:string,fn:(s:string)=>void)=>{h.events.add(fn);return{remove:()=>h.events.delete(fn)}}}}));
import {useStudioDay,attendanceDate} from './useStudioDay';let r:ReturnType<typeof create>|null=null;
afterEach(async()=>{await act(async()=>r?.unmount());r=null;vi.useRealTimers();h.events.clear();h.currentState='active'});
it('real mounted day rolls at IST midnight and catches up on resume after background sleep',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T18:29:50Z'));let day='';function Probe(){day=useStudioDay();return null};await act(async()=>{r=create(<Probe/>)});expect(day).toBe('2026-11-13');await act(async()=>{vi.advanceTimersByTime(30000)});expect(day).toBe('2026-11-14');h.currentState='background';await act(async()=>{vi.advanceTimersByTime(86400000)});expect(day).toBe('2026-11-14');h.currentState='active';await act(async()=>h.events.forEach(fn=>fn('active')));expect(day).toBe('2026-11-15');await act(async()=>r?.unmount());r=null;expect(h.events.size).toBe(0);
});
it('attendance date matches server Asia/Kolkata at UTC year boundary',()=>expect(attendanceDate(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01'));

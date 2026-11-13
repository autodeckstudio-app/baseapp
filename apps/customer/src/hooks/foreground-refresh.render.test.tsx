import React,{useEffect} from 'react';
import {act,create} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
const h=vi.hoisted(()=>({events:new Set<(state:string)=>void>(),scope:'owner'}));
vi.mock('expo-router',()=>({useFocusEffect:(fn:()=>void)=>useEffect(fn,[fn])}));
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:(_:string,fn:(state:string)=>void)=>{h.events.add(fn);return{remove:()=>h.events.delete(fn)}}}}));
import {AppState} from 'react-native';
import {useForegroundRefresh,useContentClock} from './useForegroundRefresh';
let renderer:ReturnType<typeof create>|undefined;
afterEach(async()=>{await act(async()=>renderer?.unmount());renderer=undefined;h.events.clear();(AppState as any).currentState='active';vi.useRealTimers()});
it('real mounted hook refreshes focus, visible stale bound, resume and stops background/unmounted work',async()=>{
 vi.useFakeTimers();vi.setSystemTime(0);const refresh=vi.fn();function Probe(){useForegroundRefresh(refresh,h.scope);return null;}
 await act(async()=>{renderer=create(<Probe/>)});expect(refresh).toHaveBeenCalledTimes(1);
 await act(async()=>{vi.advanceTimersByTime(300_000)});expect(refresh).toHaveBeenCalledTimes(2);
 await act(async()=>{h.events.forEach(fn=>fn('background'));vi.advanceTimersByTime(600_000)});expect(refresh).toHaveBeenCalledTimes(2);
 await act(async()=>{h.events.forEach(fn=>fn('active'))});expect(refresh).toHaveBeenCalledTimes(3);
 await act(async()=>{renderer!.unmount()});expect(h.events.size).toBe(0);
 await act(async()=>{vi.advanceTimersByTime(600_000)});expect(refresh).toHaveBeenCalledTimes(3);
});
it('real mounted clock updates at exact expiry, without waiting a minute',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));let value=0;
 function Probe(){value=useContentClock('owner',['2026-11-13T12:00:05Z']);return null;}
 await act(async()=>{renderer=create(<Probe/>)});const start=value;
 await act(async()=>{vi.advanceTimersByTime(4999)});expect(value).toBe(start);
 await act(async()=>{vi.advanceTimersByTime(1)});expect(value).toBe(start+5000);
});

it('defers an exact expiry rerender while backgrounded and catches up on resume',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));let value=0;
 function Probe(){value=useContentClock('owner',['2026-11-13T12:00:05Z']);return null;}
 await act(async()=>{renderer=create(<Probe/>)});const start=value;
 await act(async()=>{(AppState as any).currentState='background';h.events.forEach(fn=>fn('background'));vi.advanceTimersByTime(5000)});expect(value).toBe(start);
 await act(async()=>{(AppState as any).currentState='active';h.events.forEach(fn=>fn('active'))});expect(value).toBe(start+5000);
});

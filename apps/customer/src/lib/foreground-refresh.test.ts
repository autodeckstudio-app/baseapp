import{it,expect}from'vitest';
import{createForegroundRefresh,nextContentBoundary,MEDIA_READ_STALE_MS}from'./foreground-refresh';
it('refreshes on focus/resume/visible staleness, coalesces focus/resume and stops after disposal',()=>{let now=0,calls=0;const gate=createForegroundRefresh({refresh:()=>calls++,now:()=>now});gate.focus();expect(calls).toBe(1);gate.foreground(false);now=2000;gate.stale();expect(calls).toBe(1);gate.foreground(true);gate.focus();expect(calls).toBe(2);gate.blur();now=4000;gate.stale();expect(calls).toBe(2);gate.focus();expect(calls).toBe(3);gate.dispose();now=9000;gate.focus();gate.foreground(false);gate.foreground(true);gate.stale();expect(calls).toBe(3)});
it('does not read before focus or when initially backgrounded',()=>{let calls=0;const gate=createForegroundRefresh({refresh:()=>calls++});gate.stale();gate.foreground(false);gate.focus();expect(calls).toBe(0);gate.foreground(true);expect(calls).toBe(1)});
it('selects next exact content expiry and renews media before one hour',()=>{const now=Date.parse('2026-11-13T12:00:00Z');expect(nextContentBoundary(['bad',null,'2026-11-13T11:00:00Z','2026-11-13T12:01:00Z','2026-11-13T12:02:00Z'],now)).toBe(now+60000);expect(nextContentBoundary(['bad',null],now)).toBeNull();expect(MEDIA_READ_STALE_MS).toBeLessThan(60*60_000)});

it('bounds read wait and ignores a source completing after the deadline',async()=>{
 const {withReadDeadline}=await import('./foreground-refresh');
 let resolve!:(v:string)=>void;
 const promise=withReadDeadline(()=>new Promise<string>(r=>{resolve=r}),1);
 await expect(promise).rejects.toThrow('Details could not refresh in time.');
 resolve('late');
 await expect(promise).rejects.toThrow('Details could not refresh in time.');
});

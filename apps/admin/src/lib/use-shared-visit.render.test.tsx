import {it,expect,vi,afterEach} from 'vitest';
import {createElement} from 'react';
import {act,create} from 'react-test-renderer';
const api=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('./visit-service',()=>({getVisit:(...a:any[])=>api.get(...a)}));
vi.mock('./auth-context',()=>({useAdminAuth:()=>({user:{uid:'staff'},claims:{role:'admin',tenantId:'t',studioId:'s'},loading:false})}));
import {useSharedVisit} from './use-shared-visit';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();api.get.mockReset()});
it('foreground rechecks another member without anchor clock changes and cleanup removes reads',async()=>{
 vi.useFakeTimers();const focus=new EventTarget(),page=Object.assign(new EventTarget(),{visibilityState:'visible'});vi.stubGlobal('window',focus);vi.stubGlobal('document',page);
 const job:any={id:'anchor',tenantId:'t',studioId:'s',visitId:'visit',updatedAt:'same'};let latest:any;
 const first:any={status:'grouped',state:'working',members:[]};api.get.mockResolvedValue(first);
 function Probe(){latest=useSharedVisit(job);return null}let tree:any;await act(async()=>{tree=create(createElement(Probe))});expect(api.get).toHaveBeenCalledTimes(1);expect(latest.data).toBe(first);
 const second:any={status:'grouped',state:'ready',members:[]};api.get.mockResolvedValue(second);await act(async()=>{focus.dispatchEvent(new Event('focus'));});expect(api.get).toHaveBeenCalledTimes(2);expect(latest.data).toBe(second);
 page.visibilityState='hidden';await act(async()=>{vi.advanceTimersByTime(300000);});expect(api.get).toHaveBeenCalledTimes(2);
 page.visibilityState='visible';api.get.mockRejectedValue(new Error('Offline'));await act(async()=>{page.dispatchEvent(new Event('visibilitychange'));});expect(latest.data).toBeNull();expect(latest.error).toBe(true);expect(latest.progress).toBeNull();
 await act(async()=>tree.unmount());await act(async()=>{focus.dispatchEvent(new Event('focus'));vi.advanceTimersByTime(300000)});expect(api.get).toHaveBeenCalledTimes(3);
});
it('late old visit response cannot replace a new route and ungrouped route never fetches',async()=>{
 let resolve:any;api.get.mockImplementationOnce(()=>new Promise(r=>resolve=r)).mockResolvedValue({status:'ungrouped',jobId:'next'});let latest:any;
 function Probe({job}:any){latest=useSharedVisit(job);return null}let tree:any;const job:any={id:'anchor',tenantId:'t',studioId:'s',visitId:'visit',updatedAt:'same'};
 await act(async()=>{tree=create(createElement(Probe,{job}))});await act(async()=>tree.update(createElement(Probe,{job:{...job,id:'next',visitId:'other'}})));expect(latest.data.jobId).toBe('next');await act(async()=>resolve({status:'ungrouped',jobId:'anchor'}));expect(latest.data.jobId).toBe('next');await act(async()=>tree.update(createElement(Probe,{job:{...job,visitId:null}})));expect(latest.data).toBeNull();expect(api.get).toHaveBeenCalledTimes(2);await act(async()=>tree.unmount());
});

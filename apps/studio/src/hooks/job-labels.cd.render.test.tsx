import React from'react';import{act,create}from'react-test-renderer';import{it,expect,vi,afterEach}from'vitest';
const h=vi.hoisted(()=>({snapshots:[]as any[],reads:[]as any[],resume:null as any}));
vi.mock('../lib/firebase',()=>({db:{}}));vi.mock('@autodeck/database',()=>({COLLECTIONS:{vehicles:()=> 'vehicles',customers:()=> 'customers',studioConfig:()=> 'studioConfig'}}));
vi.mock('firebase/firestore',()=>({doc:(_:any,path:string,id:string)=>({path,id}),onSnapshot:(ref:any,ok:any,error:any)=>{const entry={ref,ok,error,stop:vi.fn()};h.snapshots.push(entry);return entry.stop}}));
vi.mock('react-native',()=>({AppState:{currentState:'active',addEventListener:(_:any,cb:any)=>{h.resume=cb;return{remove:vi.fn()}}}}));
vi.mock('../lib/approval-service',()=>({getActiveServices:()=>new Promise(resolve=>h.reads.push(resolve))}));
import{useJobPeople}from'./useJobPeople';import{useJobLabels}from'./useBayNames';
let r:any,people:any,labels:any;const job={tenantId:'t',vehicleId:'v',customerId:'c',vehicleSnapshot:{make:'Saved',model:'Car'}}as any;
function Probe({owner='t:u',tenant='t',jobs=[job]}:any){people=useJobPeople(jobs,owner,tenant);labels=useJobLabels('s',owner,tenant);return null}
const snap=(value:any)=>({exists:()=>value!==null,data:()=>value});
afterEach(async()=>{await act(async()=>r?.unmount());h.snapshots=[];h.reads=[];vi.useRealTimers()});
it('live visible people and bays update; account changes reject late callbacks and clear names',async()=>{
 await act(async()=>{r=create(<Probe/>)});const vehicle=h.snapshots.find(x=>x.ref.path==='vehicles'),customer=h.snapshots.find(x=>x.ref.path==='customers'),studio=h.snapshots.find(x=>x.ref.path==='studioConfig');
 await act(async()=>{vehicle.ok(snap({tenantId:'t',make:'Live',model:'Car'}));customer.ok(snap({tenantId:'t',name:'First'}));studio.ok(snap({tenantId:'t',bays:[{id:'b',name:'First bay'}]}));h.reads[0]([{id:'svc',name:'First service',tenantId:'t'}])});expect(people.car(job)).toBe('Live Car');expect(people.customer(job)).toBe('First');expect(labels.bays.b).toBe('First bay');
 await act(async()=>customer.ok(snap({tenantId:'t',name:'Renamed'})));expect(people.customer(job)).toBe('Renamed');
 await act(async()=>r.update(<Probe owner="t:other"/>));expect(customer.stop).toHaveBeenCalled();expect(people.customer(job)).toBeUndefined();expect(labels.bays).toEqual({});expect(labels.services).toEqual({});
 await act(async()=>{customer.ok(snap({tenantId:'t',name:'PRIVATE'}));studio.ok(snap({tenantId:'t',bays:[{id:'b',name:'PRIVATE'}]}))});expect(people.customer(job)).toBeUndefined();expect(labels.bays).toEqual({});
});
it('errors and tenant mismatch remove cached labels instead of retaining them',async()=>{
 await act(async()=>{r=create(<Probe/>)});const customer=h.snapshots.find(x=>x.ref.path==='customers');await act(async()=>customer.ok(snap({tenantId:'t',name:'Known'})));expect(people.customer(job)).toBe('Known');await act(async()=>customer.error(Error('offline')));expect(people.customer(job)).toBeUndefined();await act(async()=>customer.ok(snap({tenantId:'other',name:'PRIVATE'})));expect(people.customer(job)).toBeUndefined();
});
it('catalogue refreshes each foreground minute and on resume; obsolete responses cannot win',async()=>{
 vi.useFakeTimers();await act(async()=>{r=create(<Probe/>)});await act(async()=>{h.reads[0]([{id:'svc',tenantId:'t',name:'Old'}])});expect(labels.services.svc).toBe('Old');await act(async()=>{vi.advanceTimersByTime(60_000)});expect(h.reads.length).toBe(2);await act(async()=>h.resume('active'));expect(h.reads.length).toBe(3);await act(async()=>h.reads[2]([{id:'svc',tenantId:'t',name:'New'}]));await act(async()=>h.reads[1]([{id:'svc',tenantId:'t',name:'Late'}]));expect(labels.services.svc).toBe('New');
});
it('jobs leaving the feed unsubscribe their person records',async()=>{await act(async()=>{r=create(<Probe/>)});const customer=h.snapshots.find(x=>x.ref.path==='customers');await act(async()=>r.update(<Probe jobs={[]}/>));expect(customer.stop).toHaveBeenCalled();expect(people.customer(job)).toBeUndefined()});

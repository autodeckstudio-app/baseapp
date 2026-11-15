import {it,expect,vi,beforeEach} from 'vitest';
const h=vi.hoisted(()=>({watch:[] as any[]}));
vi.mock('firebase/firestore',()=>({collection:(_db:any,name:string)=>name,where:(f:string,_op:string,v:string)=>({f,v}),query:(collection:string,...filters:any[])=>({collection,filters}),onSnapshot:(q:any,yes:any,no:any)=>{const w={q,yes,no,stop:vi.fn()};h.watch.push(w);return w.stop}}));
vi.mock('firebase/functions',()=>({httpsCallable:vi.fn()}));vi.mock('expo/fetch',()=>({fetch:vi.fn()}));vi.mock('./firebase',()=>({db:{},functions:{}}));
import {listenToCustomerPapers} from './paper-service';
beforeEach(()=>h.watch.length=0);
const doc=(id:string,data:any)=>({id,data:()=>data});
it('only scopes document listeners to active current cars and discards former-generation events',()=>{
 const data=vi.fn(),error=vi.fn(),stop=listenToCustomerPapers('t','c',data,error);
 expect(h.watch[0].q).toEqual({collection:'vehicles',filters:[{f:'tenantId',v:'t'},{f:'ownerId',v:'c'}]});
 h.watch[0].yes({docs:[doc('v1',{}),doc('v2',{}),doc('archived',{deletedAt:'2026-11-09'})]});expect(h.watch).toHaveLength(3);
 expect(h.watch[1].q.filters).toContainEqual({f:'vehicleId',v:'v1'});expect(h.watch[2].q.filters).toContainEqual({f:'vehicleId',v:'v2'});
 h.watch[1].yes({docs:[doc('p1',{id:'p1',createdAt:'a'})]});h.watch[2].yes({docs:[doc('p2',{id:'p2',createdAt:'b'})]});expect(data.mock.lastCall![0].map((p:any)=>p.id)).toEqual(['p1','p2']);
 h.watch[0].yes({docs:[doc('v2',{})]});expect(h.watch[1].stop).toHaveBeenCalledOnce();expect(h.watch[2].stop).toHaveBeenCalledOnce();const calls=data.mock.calls.length;
 h.watch[1].yes({docs:[doc('p-private',{id:'p-private',createdAt:'c'})]});expect(data).toHaveBeenCalledTimes(calls);
 h.watch[3].yes({docs:[doc('p2',{id:'p2',createdAt:'b'})]});expect(data.mock.lastCall![0].map((p:any)=>p.id)).toEqual(['p2']);stop();expect(h.watch[0].stop).toHaveBeenCalledOnce();expect(h.watch[3].stop).toHaveBeenCalledOnce();
});
it('car-feed failure clears rows and all child listeners rather than retaining private stale documents',()=>{const data=vi.fn(),error=vi.fn();const stop=listenToCustomerPapers('t','c',data,error);h.watch[0].yes({docs:[doc('v1',{})]});h.watch[1].yes({docs:[doc('p1',{id:'p1',createdAt:'a'})]});const err=new Error('lost access');h.watch[0].no(err);expect(data.mock.lastCall![0]).toEqual([]);expect(error).toHaveBeenCalledWith(err);expect(h.watch[1].stop).toHaveBeenCalledOnce();stop();});

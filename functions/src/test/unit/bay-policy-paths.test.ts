import {describe,it,expect,vi,beforeEach} from 'vitest';
const h=vi.hoisted(()=>({data:{} as any,docs:{} as Record<string,any>,occupants:[] as any[],writes:[] as any[],counter:0}));
vi.mock('firebase-functions/v2/https',()=>({onCall:(_:any,fn:any)=>fn,HttpsError:class extends Error{constructor(public code:string,m:string){super(m)}}}));
vi.mock('../../middleware/auth.js',()=>({extractUser:()=>({uid:'u',claims:{role:'studio',tenantId:'t',studioId:'s'}}),assertRole:()=>{},assertTenant:(_:any,t:string)=>{if(t!=='t')throw Error('tenant')}}));
vi.mock('../../middleware/validate.js',()=>({validate:()=>h.data}));
vi.mock('../../middleware/rateLimit.js',()=>({enforceRateLimit:async()=>{},subjectFrom:()=>''}));
vi.mock('../../middleware/audit.js',()=>({writeAuditLog:()=>{}}));
vi.mock('../../lib/customer-identity.js',()=>({resolveCustomerDocId:async()=> 'c',requireCustomerDocId:async()=> 'c'}));
vi.mock('../../lib/priority-access.js',()=>({assertNotPriorityHeld:async()=>{}}));
vi.mock('firebase-admin/firestore',()=>{
 const snap=(path:string)=>({id:path.split('/').pop(),exists:path in h.docs,data:()=>h.docs[path]});
 const ref=(path:string):any=>({id:path.split('/').pop(),path,doc:(id?:string)=>ref(path+'/'+(id??'new'+(++h.counter))),get:async()=>snap(path),where:()=>ref(path),limit:()=>ref(path)});
 const tx={get:async(r:any)=>r.path.endsWith('jobs')?{docs:h.occupants.map(x=>({id:x.id,data:()=>x}))}:snap(r.path),set:(r:any,v:any)=>h.writes.push({path:r.path,value:v}),update:(r:any,v:any)=>h.writes.push({path:r.path,value:v})};
 return {getFirestore:()=>({collection:(s:string)=>ref(s),runTransaction:async(fn:any)=>fn(tx)})};
});
import {createWalkinJob} from '../../functions/job/createWalkinJob';
import {releaseCompletedBay} from '../../functions/job/releaseCompletedBay';
import {hasReleasedBay,jobHoldsBay} from '@autodeck/core';
import {assignBay} from '../../functions/job/assignBay';
import {COLLECTIONS} from '@autodeck/database';
const hours=Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:'00:00',close:'23:59',closed:false}));
beforeEach(()=>{h.writes=[];h.counter=0;h.occupants=[];h.docs={};h.data={serviceId:'p',studioId:'s',vehicleId:'v',customerId:'c',bayId:'bay',vehicleCategory:'sedan'};h.docs[COLLECTIONS.services()+'/p']={id:'p',tenantId:'t',category:'ppf',active:true,requiredBayType:'protection',estimatedDurationMinutes:2880,basePrice:100000,vehicleCategoryPricing:[]};h.docs[COLLECTIONS.studioConfig()+'/s']={tenantId:'t',timezone:'Asia/Kolkata',operatingHours:hours,holidays:[],currency:'INR',bays:[{id:'bay',active:true,bayType:'protection'}]};h.docs[COLLECTIONS.vehicles()+'/v']={tenantId:'t',ownerId:'c'};h.docs[COLLECTIONS.customers()+'/c']={tenantId:'t'};});
describe('working24 early physical release actual callable, mocked data boundary only',()=>{
 const setup=()=>{h.data={jobId:'j',confirmWorkCompleteAndBayEmpty:true};h.docs[COLLECTIONS.jobs()+'/j']={id:'j',tenantId:'t',studioId:'s',customerId:'c',bookingId:'b',bayId:'bay',status:'READY_FOR_DELIVERY',estimatedEndAt:'2026-11-10T10:00:00Z',paymentStatus:'unpaid'};h.docs[COLLECTIONS.bookings()+'/b']={tenantId:'t',studioId:'s',customerId:'c',bayId:'bay'};};
 it('release writes only receipt, never payment/status/completion',async()=>{setup();await(releaseCompletedBay as any)({});expect(h.writes).toHaveLength(3);for(const x of h.writes.slice(0,2)){expect(x.value.bayReleasedBy).toBe('u');expect(Number.isFinite(Date.parse(x.value.bayReleasedAt))).toBe(true);expect(Object.keys(x.value).sort()).toEqual(['bayReleasedAt','bayReleasedBy','updatedAt']);}});
 it.each(['IN_PROGRESS','QUALITY_CHECK','PENDING_VEHICLE','DELIVERED','CANCELLED','STANDBY'])('refuses %s',async(status)=>{setup();h.docs[COLLECTIONS.jobs()+'/j'].status=status;await expect((releaseCompletedBay as any)({})).rejects.toThrow('Only completed');expect(h.writes).toHaveLength(0)});
 it('mismatched linked booking writes nothing',async()=>{setup();h.docs[COLLECTIONS.bookings()+'/b'].customerId='wrong';await expect((releaseCompletedBay as any)({})).rejects.toThrow('Linked booking');expect(h.writes).toHaveLength(0)});
 it('retry is read-only',async()=>{setup();Object.assign(h.docs[COLLECTIONS.jobs()+'/j'],{bayReleasedAt:'2026-11-04T12:00:00Z',bayReleasedBy:'u'});await(releaseCompletedBay as any)({});expect(h.writes).toHaveLength(0)});
 it('ready alone/malformed receipt hold, valid receipt releases',()=>{const j={status:'READY_FOR_DELIVERY',estimatedEndAt:'2026-01-01T00:00:00Z'};expect(jobHoldsBay(j)).toBe(true);expect(jobHoldsBay({...j,bayReleasedAt:'2026-11-04T12:00:00Z',bayReleasedBy:'u'})).toBe(false);expect(jobHoldsBay({...j,bayReleasedAt:'bad',bayReleasedBy:'u'})).toBe(true);expect(hasReleasedBay({...j,status:'IN_PROGRESS',bayReleasedAt:'2026-11-04T12:00:00Z',bayReleasedBy:'u'})).toBe(false)});
 it('released ready car no longer blocks actual walk-in',async()=>{h.occupants=[{id:'ready',status:'READY_FOR_DELIVERY',bayReleasedAt:'2026-11-04T12:00:00Z',bayReleasedBy:'u',estimatedEndAt:'2026-11-10T12:00:00Z',scheduledAt:'2026-11-04T10:00:00Z'}];await(createWalkinJob as any)({});expect(h.writes.some(x=>x.path.startsWith(COLLECTIONS.jobs()+'/'))).toBe(true)});
 it('unreleased ready car still blocks actual walk-in',async()=>{h.occupants=[{id:'ready',status:'READY_FOR_DELIVERY',estimatedEndAt:'2026-01-01T00:00:00Z'}];await expect((createWalkinJob as any)({})).rejects.toThrow('still occupied');expect(h.writes).toHaveLength(0)});
 it('release refuses cross-tenant job',async()=>{setup();h.docs[COLLECTIONS.jobs()+'/j'].tenantId='wrong';await expect((releaseCompletedBay as any)({})).rejects.toThrow('tenant');expect(h.writes).toHaveLength(0)});
 it('released bay cannot be reassigned without new visit',async()=>{setup();Object.assign(h.docs[COLLECTIONS.jobs()+'/j'],{serviceId:'p',bayReleasedAt:'2026-11-04T12:00:00Z',bayReleasedBy:'u'});h.data={jobId:'j',bayId:'bay'};await expect((assignBay as any)({})).rejects.toThrow('released as empty');expect(h.writes).toHaveLength(0)});

});

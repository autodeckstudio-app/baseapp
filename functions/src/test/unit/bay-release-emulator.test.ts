import {it,expect,vi,beforeAll,afterAll} from 'vitest';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
vi.mock('firebase-functions/v2/https',()=>({onCall:(_:any,fn:any)=>fn,HttpsError:class extends Error{constructor(public code:string,m:string){super(m)}}}));
vi.mock('../../middleware/auth.js',()=>({extractUser:()=>({uid:'u',claims:{role:'studio',tenantId:'t',studioId:'s'}}),assertRole:()=>{},assertTenant:(_:any,t:string)=>{if(t!=='t')throw Error('tenant')}}));
vi.mock('../../middleware/rateLimit.js',()=>({enforceRateLimit:async()=>{},subjectFrom:()=>''}));
import {releaseCompletedBay} from '../../functions/job/releaseCompletedBay';
import {assignBay} from '../../functions/job/assignBay';
import {COLLECTIONS} from '@autodeck/database';
let app:any,db:ReturnType<typeof getFirestore>;
beforeAll(()=>{if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8189')throw Error('LOCAL EMULATOR REQUIRED');app=initializeApp({projectId:'demo-autodeck-local'});db=getFirestore(app)});
afterAll(async()=>{await db.terminate();await deleteApp(app)});
const setup=async(id:string)=>{const j={id,tenantId:'t',studioId:'s',customerId:'c',serviceId:'p',bookingId:'b'+id,bayId:'bay1',status:'READY_FOR_DELIVERY',statusHistory:[],scheduledAt:'2026-11-04T10:00:00Z',estimatedEndAt:'2026-11-10T10:00:00Z',estimatedDurationMinutes:1440,paymentStatus:'unpaid',totalAmount:500000};await db.collection('jobs').doc(id).set(j);await db.collection('bookings').doc('b'+id).set({...j,id:'b'+id,status:'ACTIVE'});return j;};
it('REAL Firestore concurrent duplicate release serializes with one audit and same receipt',async()=>{
 const id='duplicate';await setup(id);const req={data:{jobId:id,confirmWorkCompleteAndBayEmpty:true}};
 const outcomes=await Promise.all(Array.from({length:4},()=> (releaseCompletedBay as any)(req)));
 const j=(await db.collection('jobs').doc(id).get()).data()!,b=(await db.collection('bookings').doc('b'+id).get()).data()!;
 expect(new Set(outcomes.map(x=>x.bayReleasedAt)).size).toBe(1);expect(outcomes.filter(x=>!x.alreadyReleased)).toHaveLength(1);
 expect(j.bayReleasedAt).toBe(b.bayReleasedAt);expect(j.status).toBe('READY_FOR_DELIVERY');expect(j.paymentStatus).toBe('unpaid');expect(j.totalAmount).toBe(500000);expect(j.estimatedEndAt).toBe('2026-11-10T10:00:00Z');
 const audits=await db.collection(COLLECTIONS.auditLog()).where('entityId','==',id).get();expect(audits.size).toBe(1);expect(audits.docs[0].data().action).toBe('job.bay_released');
},30000);
it('REAL release vs reassignment race never leaves released car assigned elsewhere silently',async()=>{
 const id='race';await setup(id);await db.collection('services').doc('p').set({tenantId:'t',requiredBayType:'protection'});await db.collection(COLLECTIONS.studioConfig()).doc('s').set({tenantId:'t',timezone:'Asia/Kolkata',operatingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,open:'00:00',close:'23:59',closed:false})),holidays:[],bays:[{id:'bay1',active:true,bayType:'protection'},{id:'bay2',active:true,bayType:'protection'}]});
 const result=await Promise.allSettled([(releaseCompletedBay as any)({data:{jobId:id,confirmWorkCompleteAndBayEmpty:true}}),(assignBay as any)({data:{jobId:id,bayId:'bay2'}})]);
 const j=(await db.collection('jobs').doc(id).get()).data()!,b=(await db.collection('bookings').doc('b'+id).get()).data()!;
 expect(result[0].status).toBe('fulfilled');expect(j.bayId).toBe(b.bayId);expect(j.bayReleasedAt).toBe(b.bayReleasedAt);expect(j.bayReleasedBy).toBe('u');expect(j.status).toBe('READY_FOR_DELIVERY');expect(j.paymentStatus).toBe('unpaid');
 // If reassignment commits first, release confirms that freshly moved bay.
 // If release wins first, fresh reassignment must refuse.
 if(result[1].status==='fulfilled')expect(j.bayId).toBe('bay2');else expect(j.bayId).toBe('bay1');
},30000);

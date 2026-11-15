const proofStorage=vi.hoisted(()=>({signed:[] as any[],beforeMetadata:null as null|(()=>Promise<void>)}));
vi.mock('firebase-admin/storage',()=>({getStorage:()=>({bucket:()=>({file:()=>({getMetadata:async()=>{await proofStorage.beforeMetadata?.();return[{size:'100',contentType:'image/jpeg',metadata:{studioid:'s'}}]},getSignedUrl:async(o:any)=>{proofStorage.signed.push(o);return['https://synthetic.invalid/local-proof']}})})})}));
import {visitWorkReview} from '../../lib/visit-work-review.js';
import {it,expect,vi,beforeAll,afterAll,beforeEach} from 'vitest';import{initializeTestEnvironment,type RulesTestEnvironment}from'@firebase/rules-unit-testing';import{getFirestore}from'firebase-admin/firestore';import{readFileSync}from'node:fs';import{resolve}from'node:path';import{randomUUID}from'node:crypto';import{TEST_PROJECT_ID}from'../emulator-setup';import{joinVisit}from'../../functions/visit/joinVisit';import{getMyVisit,getStaffVisit}from'../../functions/visit/getVisit';
const db=getFirestore();let env:RulesTestEnvironment;const request=(data:any,role='studio',uid='staff')=>({data,auth:{uid,token:{role,tenantId:'t',studioId:'s'}}}as any);
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:TEST_PROJECT_ID,firestore:{host:'127.0.0.1',port:Number(process.env.FIRESTORE_EMULATOR_TEST_PORT),rules:readFileSync(resolve(__dirname,'../../../../firestore.rules'),'utf8')}})});afterAll(async()=>env.cleanup());
beforeEach(async()=>{await env.clearFirestore();await db.collection('customers').doc('c').set({id:'c',authUid:'customer',tenantId:'t',deletedAt:null});await db.collection('vehicles').doc('v').set({id:'v',tenantId:'t',ownerId:'c',deletedAt:null});for(const id of ['wash','ceramic'])await db.collection('jobs').doc(id).set({id,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'v',serviceId:id,lines:[{serviceId:id,name:id==='wash'?'Wash':'Ceramic'}],status:'READY_FOR_DELIVERY',updatedAt:'old',scheduledDate:'2026-11-14',totalAmount:10000,paymentStatus:'unpaid',priceBreakdown:{pickupFee:0,dropFee:0},bookingId:null,statusHistory:[]});});
const data=()=>({operationId:randomUUID(),confirmed:true,members:[{jobId:'wash',expectedUpdatedAt:'old'},{jobId:'ceramic',expectedUpdatedAt:'old'}]});
it('explicit join creates group only, leaves all financial/work fields intact and one read projects bill/status',async()=>{const before=await Promise.all(['wash','ceramic'].map(async id=>(await db.collection('jobs').doc(id).get()).data()!));const input=data();const joined=await joinVisit.run(request(input));expect(joined).toMatchObject({alreadyJoined:false});expect(await joinVisit.run(request(input))).toEqual({...joined,alreadyJoined:true});for(const[id,i]of[['wash',0],['ceramic',1]]as const){const after=(await db.collection('jobs').doc(id).get()).data()!;const{visitId,updatedAt,...rest}=after;const{updatedAt:old,...prior}=before[i]!;expect(rest).toEqual(prior);expect(visitId).toBe(joined.visitId);}expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({status:'grouped',state:'working',bill:{totalAmount:20000},members:[{jobId:'wash',serviceStatus:'Check work'},{jobId:'ceramic',serviceStatus:'Check work'}]});expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('invoices').get()).empty).toBe(true);});
it('same customer/car/date alone never groups, while a customer can read only their explicit visit',async()=>{expect(await getStaffVisit.run(request({jobId:'wash'}))).toEqual({status:'ungrouped',jobId:'wash'});await joinVisit.run(request(data()));expect(await getMyVisit.run(request({jobId:'wash'},'customer','customer'))).toMatchObject({status:'grouped'});await db.collection('customers').doc('other').set({id:'other',tenantId:'t',authUid:'stranger',deletedAt:null});await expect(getMyVisit.run(request({jobId:'wash'},'customer','stranger'))).rejects.toBeDefined();});
it.each(['customer','accountant'])('%s cannot join',async role=>{await expect(joinVisit.run(request(data(),role))).rejects.toMatchObject({code:'permission-denied'});expect((await db.collection('carVisits').get()).empty).toBe(true)});
it.each([{customerId:'other'},{vehicleId:'other'},{studioId:'other'},{tenantId:'other'},{status:'DELIVERED'},{status:'CANCELLED'},{updatedAt:'new'},{status:'PENDING_VEHICLE',scheduledDate:'2026-11-15'},{visitId:'existing'}])('incompatible member %j fails without partial grouping',async patch=>{await db.collection('jobs').doc('ceramic').update(patch);await expect(joinVisit.run(request(data()))).rejects.toBeDefined();expect((await db.collection('jobs').doc('wash').get()).data()!.visitId).toBeUndefined();expect((await db.collection('carVisits').get()).empty).toBe(true)});
it('pending payment and duplicate charged transport are incompatible without repricing or refunds',async()=>{await db.collection('payments').doc('p').set({jobId:'wash',status:'pending'});await expect(joinVisit.run(request(data()))).rejects.toThrow('payment in flight');await db.collection('payments').doc('p').delete();for(const id of ['wash','ceramic'])await db.collection('jobs').doc(id).update({'priceBreakdown.pickupFee':1000});await expect(joinVisit.run(request(data()))).rejects.toThrow('transport conflict');expect((await db.collection('carVisits').get()).empty).toBe(true)});
it('scope drift/missing member after join never returns a false ready bill',async()=>{await joinVisit.run(request(data()));await db.collection('jobs').doc('ceramic').update({customerId:'other'});await expect(getStaffVisit.run(request({jobId:'wash'}))).rejects.toBeDefined()});
it('partial delivery has an honest incomplete state and delivered is never another pickup',async()=>{await joinVisit.run(request(data()));await db.collection('jobs').doc('wash').update({status:'DELIVERED'});expect(await getStaffVisit.run(request({jobId:'ceramic'}))).toMatchObject({state:'handover_incomplete'});await db.collection('jobs').doc('ceramic').update({status:'DELIVERED'});expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({state:'delivered'})});

it('staff can explicitly join multi-day work already with the studio without changing reservations',async()=>{await db.collection('jobs').doc('ceramic').update({scheduledDate:'2026-11-15'});await joinVisit.run(request(data()));expect((await db.collection('jobs').doc('ceramic').get()).data()!.scheduledDate).toBe('2026-11-15');expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({status:'grouped',state:'working'})});

it('shared handover is durable, per-member and retry-safe without bulk delivery or synthetic payments',async()=>{
 const{recordJobPerformedWork}=await import('../../functions/work/recordJobPerformedWork.js');const{advanceJobStatus}=await import('./stage-fixture.js');const{startVisitHandover}=await import('../../functions/visit/startVisitHandover.js');
 for(const id of ['wash','ceramic']){
  await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:0,action:'record',lineId:'booked-0',approvalId:null,performed:true,work:{kind:'service'}}));
  await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:1,action:'qc',lineId:'booked-0',checked:true}));
  await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:2,action:'seal',confirmed:true},'admin'));
  await db.collection('jobs').doc(id).update({paymentStatus:'paid',additionalWorkDelta:0});await db.collection('invoices').doc(id).set({id,tenantId:'t',jobId:id,customerId:'c',vehicleId:'v',status:'issued',total:10000});
 }
 const times=await Promise.all(['wash','ceramic'].map(async jobId=>({jobId,expectedUpdatedAt:(await db.collection('jobs').doc(jobId).get()).data()!.updatedAt})));
 const joined=await joinVisit.run(request({...data(),members:times}));
 await expect(advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3}))).rejects.toThrow('shared visit handover');
 const start={visitId:joined.visitId,expectedRevision:1,operationId:randomUUID(),confirmed:true,members:await reviewMembers()};const manifest=await startVisitHandover.run(request(start));expect(await startVisitHandover.run(request(start))).toEqual({...manifest,alreadyStarted:true});
 await expect(startVisitHandover.run(request({...start,operationId:randomUUID()}))).rejects.toThrow('existing shared handover');
 expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('READY_FOR_DELIVERY');
 await advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}));
 expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({state:'handover_incomplete',handover:{status:'incomplete',outcomes:{wash:{status:'delivered'}}}});
 await db.collection('jobs').doc('ceramic').update({paymentStatus:'unpaid'});
 await expect(advanceJobStatus.run(request({jobId:'ceramic',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}))).rejects.toThrow('every remaining service');
 expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('DELIVERED');
 await db.collection('jobs').doc('ceramic').update({paymentStatus:'paid'});
 await advanceJobStatus.run(request({jobId:'ceramic',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}));
 expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({state:'delivered',handover:{status:'complete',outcomes:{wash:{status:'delivered'},ceramic:{status:'delivered'}}}});
 await expect(advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}))).rejects.toThrow('already delivered');
 expect((await db.collection('invoices').get()).size).toBe(2);
});

async function readyHandover(){
 const{recordJobPerformedWork}=await import('../../functions/work/recordJobPerformedWork.js');const{advanceJobStatus}=await import('./stage-fixture.js');const{startVisitHandover}=await import('../../functions/visit/startVisitHandover.js');
 for(const id of ['wash','ceramic']){
  await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:0,action:'record',lineId:'booked-0',approvalId:null,performed:true,work:{kind:'service'}}));
  await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:1,action:'qc',lineId:'booked-0',checked:true}));
  await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:2,action:'seal',confirmed:true},'admin'));
  await db.collection('jobs').doc(id).update({paymentStatus:'paid',additionalWorkDelta:0});await db.collection('invoices').doc(id).set({id,tenantId:'t',jobId:id,customerId:'c',vehicleId:'v',status:'issued',total:10000});
 }
 const times=await Promise.all(['wash','ceramic'].map(async jobId=>({jobId,expectedUpdatedAt:(await db.collection('jobs').doc(jobId).get()).data()!.updatedAt})));
 const joined=await joinVisit.run(request({...data(),members:times}));
 const start={visitId:joined.visitId,expectedRevision:1,operationId:randomUUID(),confirmed:true as const,members:await reviewMembers()};
 const manifest=await startVisitHandover.run(request(start));
 return{start,manifest,startVisitHandover,advanceJobStatus};
}
const reviewMembers=async()=>Promise.all(['wash','ceramic'].map(async jobId=>({jobId,expectedUpdatedAt:(await db.collection('jobs').doc(jobId).get()).data()!.updatedAt,recordedWork:visitWorkReview((await db.collection('jobPerformedWork').doc(jobId).get()).data())})));
it('rechecks every member before any delivery and resumes only after an exact current review',async()=>{
 const{start,manifest,startVisitHandover,advanceJobStatus}=await readyHandover();
 await db.collection('jobs').doc('ceramic').update({updatedAt:'changed',status:'IN_PROGRESS'});
 await expect(advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}))).rejects.toThrow('every remaining service');
 const stale=await reviewMembers();
 await expect(startVisitHandover.run(request({...start,operationId:randomUUID(),members:await reviewMembers(),review:{priorManifestId:manifest.manifestId,members:stale}}))).rejects.toThrow('Every service must be ready');
 await db.collection('jobs').doc('ceramic').update({status:'READY_FOR_DELIVERY',updatedAt:'reviewed'});
 await expect(startVisitHandover.run(request({...start,operationId:randomUUID(),members:await reviewMembers(),review:{priorManifestId:manifest.manifestId,members:stale}}))).rejects.toThrow('Review every current service');
 const review={...start,operationId:randomUUID(),members:await reviewMembers(),review:{priorManifestId:manifest.manifestId,members:await reviewMembers()}};
 const refreshed=await startVisitHandover.run(request(review));
 expect(await startVisitHandover.run(request(review))).toEqual({...refreshed,alreadyStarted:true});
 expect((await db.collection('visitHandovers').doc(manifest.manifestId).get()).data()).toMatchObject({status:'superseded',supersededBy:refreshed.manifestId});
 await expect(advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}))).rejects.toThrow('Shared handover changed');
 await advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:refreshed.manifestId}));
});
it('review after a partial outcome preserves delivered evidence and never resets a job or creates money',async()=>{
 const{start,manifest,startVisitHandover,advanceJobStatus}=await readyHandover();
 await advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}));
 const delivered=(await db.collection('jobs').doc('wash').get()).data();
 const outcome=(await db.collection('visitHandovers').doc(manifest.manifestId).get()).data()!.outcomes.wash;
 await db.collection('jobs').doc('ceramic').update({updatedAt:'changed'});
 const next=await startVisitHandover.run(request({...start,operationId:randomUUID(),members:await reviewMembers(),review:{priorManifestId:manifest.manifestId,members:await reviewMembers()}}));
 expect((await db.collection('jobs').doc('wash').get()).data()).toEqual(delivered);
 expect((await db.collection('visitHandovers').doc(next.manifestId).get()).data()!.outcomes.wash).toEqual(outcome);
 await advanceJobStatus.run(request({jobId:'ceramic',recordedWorkRevision:3,visitHandoverId:next.manifestId}));
 expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({state:'delivered',handover:{status:'complete'}});
 expect((await db.collection('payments').get()).size).toBe(0);expect((await db.collection('invoices').get()).size).toBe(2);
});
it('handover rechecks current car ownership instead of treating grouping as lasting permission',async()=>{
 const{start,startVisitHandover}=await readyHandover();
 await db.collection('vehicles').doc('v').update({ownerId:'other'});
 // Exact existing operation retries are receipts, not new effects.
 await expect(startVisitHandover.run(request({...start,operationId:randomUUID(),members:await reviewMembers(),review:{priorManifestId:(await db.collection('carVisits').doc(start.visitId).get()).data()!.activeHandoverId,members:await reviewMembers()}}))).rejects.toThrow('ownership changed');
});

it('an altered invoice on another member prevents any new outcome',async()=>{
 const{manifest,advanceJobStatus}=await readyHandover();
 await db.collection('invoices').doc('ceramic').update({total:1});
 await expect(advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}))).rejects.toThrow('every original invoice');
 expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('READY_FOR_DELIVERY');
 expect((await db.collection('visitHandovers').doc(manifest.manifestId).get()).data()!.outcomes).toEqual({});
});
it('shared ready notification waits for every exact checked service and has a once-per-visit key',async()=>{
 const{start}=await readyHandover();const{buildNotification}=await import('../../lib/notification-events.js');
 const event=(id:string,status:string)=>buildNotification(db,{action:'job.status_advanced',entityId:id,after:{status}}as any);
 await db.collection('jobs').doc('ceramic').update({status:'IN_PROGRESS'});
 expect(await event('wash','READY_FOR_DELIVERY')).toBeNull();
 await db.collection('jobs').doc('ceramic').update({status:'READY_FOR_DELIVERY'});
 const first=await event('wash','READY_FOR_DELIVERY'),second=await event('ceramic','READY_FOR_DELIVERY');
 expect(first).toMatchObject({type:'job_completed',dedupeKey:`visit-${start.visitId}-job_completed`});expect(second?.dedupeKey).toBe(first?.dedupeKey);
 await db.collection('jobs').doc('wash').update({status:'DELIVERED'});
 expect(await event('wash','DELIVERED')).toBeNull();
 expect(await event('ceramic','READY_FOR_DELIVERY')).toBeNull();
 await db.collection('jobs').doc('ceramic').update({status:'DELIVERED'});
 expect(await event('ceramic','DELIVERED')).toMatchObject({type:'vehicle_delivered',dedupeKey:`visit-${start.visitId}-vehicle_delivered`});
});
it('stored ready statuses without recorded work never create a shared collection notification',async()=>{
 const joined=await joinVisit.run(request(data()));const{buildNotification}=await import('../../lib/notification-events.js');
 expect(await getStaffVisit.run(request({jobId:'wash'}))).toMatchObject({state:'working',members:[{serviceStatus:'Check work'},{serviceStatus:'Check work'}]});
 expect(await buildNotification(db,{action:'job.status_advanced',entityId:'wash',after:{status:'READY_FOR_DELIVERY'}}as any)).toBeNull();
 expect(joined.visitId).toBeTruthy();
});
async function attachBookings(visitId:string){for(const id of ['wash','ceramic']){await db.collection('jobs').doc(id).update({bookingId:id});await db.collection('bookings').doc(id).set({id,visitId,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'v',status:'CONFIRMED'});}}
it('concurrent requests on two services reserve exactly one visit transport owner without a charge',async()=>{
 const{start}=await readyHandover();await attachBookings(start.visitId);const{requestPickupDrop}=await import('../../functions/booking/pickupRequests.js');
 const outcomes=await Promise.allSettled(['wash','ceramic'].map(bookingId=>requestPickupDrop.run(request({bookingId,kind:'drop',address:'Local emulator sample address'},'customer','customer'))));
 expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await db.collection('pickupRequests').get()).size).toBe(1);
 expect((await db.collection('carVisits').doc(start.visitId).get()).data()!.transportJobId).toMatch(/wash|ceramic/);expect((await db.collection('payments').get()).size).toBe(0);
});
it('grouped car already at studio cannot request a second pickup; drop completion waits on the whole reviewed visit',async()=>{
 const{start,manifest,advanceJobStatus}=await readyHandover();await attachBookings(start.visitId);const{requestPickupDrop,updatePickupRequest}=await import('../../functions/booking/pickupRequests.js');
 await expect(requestPickupDrop.run(request({bookingId:'wash',kind:'both',address:'Local emulator sample address'},'customer','customer'))).rejects.toThrow('already with this visit');
 await requestPickupDrop.run(request({bookingId:'wash',kind:'drop',address:'Local emulator sample address'},'customer','customer'));
 await db.collection('pickupRequests').doc('wash').update({status:'CONFIRMED',feePaise:0});
 await db.collection('jobs').doc('ceramic').update({status:'IN_PROGRESS'});
 await expect(updatePickupRequest.run(request({requestId:'wash',status:'CONFIRMED',markLegCompleted:'drop'}))).rejects.toThrow('Finish every visit service');
 expect((await db.collection('pickupRequests').doc('wash').get()).data()!.dropCompletedAt).toBeUndefined();
 await db.collection('jobs').doc('ceramic').update({status:'READY_FOR_DELIVERY'});
 await advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}));
 await expect(updatePickupRequest.run(request({requestId:'wash',status:'CONFIRMED',markLegCompleted:'drop'}))).rejects.toThrow('Finish every visit service');
});
it('shared transport owner cancellation is held; independent service cancellation cannot cancel the other service',async()=>{
 const{checkVisitCancellation}=await import('../../lib/visit-cancellation.js');const joined=await joinVisit.run(request(data()));
 await db.collection('carVisits').doc(joined.visitId).update({transportJobId:'wash'});
 const wash=(await db.collection('jobs').doc('wash').get()).data() as any,ceramic=(await db.collection('jobs').doc('ceramic').get()).data() as any;
 await expect(db.runTransaction(tx=>checkVisitCancellation(tx,db,wash))).rejects.toThrow('pickup and drop');
 await db.runTransaction(tx=>checkVisitCancellation(tx,db,ceramic));expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('READY_FOR_DELIVERY');
});

it('one handover confirmation uses exact guarded transitions and complete retry never redelivers',async()=>{
 const{manifest}=await readyHandover();const{completeVisitHandover}=await import('../../functions/visit/completeVisitHandover.js');
 const result=await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}));
 expect(result).toMatchObject({status:'complete',error:null,outcomes:{wash:{status:'delivered'},ceramic:{status:'delivered'}}});
 const before=await Promise.all(['wash','ceramic'].map(async id=>(await db.collection('jobs').doc(id).get()).data()));
 expect(await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}))).toEqual(result);
 expect(await Promise.all(['wash','ceramic'].map(async id=>(await db.collection('jobs').doc(id).get()).data()))).toEqual(before);
 expect((await db.collection('payments').get()).size).toBe(0);
});
it('partial server attempt reports exact committed outcomes, stops, and retry continues without rollback',async()=>{
 const{manifest,advanceJobStatus}=await readyHandover();const{completeVisitHandover}=await import('../../functions/visit/completeVisitHandover.js');
 const raw=(await import('../../functions/job/advanceJobStatus.js')).advanceJobStatus;const run=raw.run;let count=0;
 const spy=vi.spyOn(raw,'run').mockImplementation(async r=>{const result=await run(r);if(++count===1)await db.collection('jobs').doc('ceramic').update({paymentStatus:'unpaid'});return result;});
 let partial;try{partial=await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}));}finally{spy.mockRestore();}
 expect(partial).toMatchObject({status:'incomplete',outcomes:{wash:{status:'delivered'}}});expect(partial!.error).toContain('every remaining service');
 const before=(await db.collection('jobs').doc('wash').get()).data();
 await db.collection('jobs').doc('ceramic').update({paymentStatus:'paid'});
 expect(await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}))).toMatchObject({status:'complete'});
 expect((await db.collection('jobs').doc('wash').get()).data()).toEqual(before);
});
it('join candidates are suggestions only and exclude conflicting owner or already-grouped jobs',async()=>{
 const{getVisitJoinOptions}=await import('../../functions/visit/getVisitJoinOptions.js');
 expect(await getVisitJoinOptions.run(request({jobId:'wash'}))).toMatchObject({jobId:'wash',expectedUpdatedAt:'old',options:[{jobId:'ceramic',service:'Ceramic'}],bounded:false});
 expect((await db.collection('carVisits').get()).empty).toBe(true);
 await db.collection('jobs').doc('ceramic').update({customerId:'other'});
 expect(await getVisitJoinOptions.run(request({jobId:'wash'}))).toMatchObject({options:[]});
 await db.collection('jobs').doc('ceramic').update({customerId:'c'});await joinVisit.run(request(data()));
 expect(await getVisitJoinOptions.run(request({jobId:'wash'}))).toMatchObject({options:[]});
 await expect(getVisitJoinOptions.run(request({jobId:'wash'},'customer','customer'))).rejects.toMatchObject({code:'permission-denied'});
});

it('staff review binds exact ledger even when a work update leaves job timestamp unchanged',async()=>{
 const{start,manifest,startVisitHandover}=await readyHandover();
 const read:any=await getStaffVisit.run(request({jobId:'wash'}));
 const before=(await db.collection('jobs').doc('ceramic').get()).data()!;
 expect(read.members.find((m:any)=>m.jobId==='ceramic').recordedWork).toEqual(start.members.find(m=>m.jobId==='ceramic')!.recordedWork);
 const ref=db.collection('jobPerformedWork').doc('ceramic'),snap=(await ref.get()).data()!;
 // Simulate a fully consistent new immutable revision without touching job time.
 snap.ledger.revision++;await ref.set(snap);await ref.collection('revisions').doc(String(snap.ledger.revision)).set(snap);
 const stale={...start,operationId:randomUUID(),review:{priorManifestId:manifest.manifestId,members:start.members}};
 await expect(startVisitHandover.run(request(stale))).rejects.toThrow('Recorded work changed');
 expect((await db.collection('visitHandovers').doc(manifest.manifestId).get()).data()!.status).toBe('pending');
 expect((await db.collection('carVisits').doc(start.visitId).get()).data()!.activeHandoverId).toBe(manifest.manifestId);
 expect((await db.collection('jobs').doc('ceramic').get()).data()!.updatedAt).toBe(before.updatedAt);
 const fresh=await reviewMembers();
 const next=await startVisitHandover.run(request({...stale,members:fresh,review:{priorManifestId:manifest.manifestId,members:fresh}}));
 expect((await db.collection('visitHandovers').doc(next.manifestId).get()).data()!.expected.ceramic).toMatchObject({recordedWorkRevision:4,recordedWorkHash:fresh.find(m=>m.jobId==='ceramic')!.recordedWork!.hash});
 const self:any=await getMyVisit.run(request({jobId:'wash'},'customer','customer'));expect(self.members.every((m:any)=>m.recordedWork===undefined)).toBe(true);
});
it('a changed snapshot at the same revision cannot pass a previously confirmed manifest',async()=>{
 const{manifest,advanceJobStatus}=await readyHandover();
 const ref=db.collection('jobPerformedWork').doc('ceramic'),snap=(await ref.get()).data()!;
 snap.products={changed:'Changed evidence'};await ref.set(snap);await ref.collection('revisions').doc(String(snap.ledger.revision)).set(snap);
 await expect(advanceJobStatus.run(request({jobId:'wash',recordedWorkRevision:3,visitHandoverId:manifest.manifestId}))).rejects.toThrow('Shared work changed');
 expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('READY_FOR_DELIVERY');
 expect((await db.collection('visitHandovers').doc(manifest.manifestId).get()).data()!.outcomes).toEqual({});
});

it('shared pickup proof uses only its one request and drop checks every service before mint or sealing',async()=>{
 const{start}=await readyHandover();const{issuePickupHandoverPhotoUploadUrl,recordPickupHandover,getPickupHandover}=await import('../../functions/booking/pickupHandover.js');proofStorage.signed=[];proofStorage.beforeMetadata=null;
 for(const id of ['wash','ceramic']){await db.collection('bookings').doc(id).set({id,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'v',status:'CONFIRMED',visitId:start.visitId});await db.collection('jobs').doc(id).update({bookingId:id})}
 await db.collection('carVisits').doc(start.visitId).update({transportJobId:'wash'});
 await db.collection('pickupRequests').doc('wash').set({id:'wash',bookingId:'wash',tenantId:'t',studioId:'s',customerId:'c',status:'CONFIRMED',kind:'both'});
 const mint={requestId:'wash',leg:'drop',contentType:'image/jpeg'},proof={requestId:'wash',leg:'drop',driverName:'Driver A',odometerKm:100,photoPaths:['t/pickupProof/wash/drop/abc.jpg']};
 await db.collection('jobs').doc('ceramic').update({status:'IN_PROGRESS'});
 await expect(issuePickupHandoverPhotoUploadUrl.run(request(mint))).rejects.toThrow('Finish every');await expect(recordPickupHandover.run(request(proof))).rejects.toThrow('Finish every');expect(proofStorage.signed).toHaveLength(0);expect((await db.collection('pickupHandovers').get()).empty).toBe(true);
 await db.collection('jobs').doc('ceramic').update({status:'READY_FOR_DELIVERY'});
 await expect(issuePickupHandoverPhotoUploadUrl.run(request(mint))).resolves.toMatchObject({path:expect.stringContaining('t/pickupProof/wash/drop/')});expect(proofStorage.signed).toHaveLength(1);
 proofStorage.beforeMetadata=async()=>{await db.collection('jobs').doc('ceramic').update({paymentStatus:'unpaid'})};
 await expect(recordPickupHandover.run(request(proof))).rejects.toThrow('every remaining service');expect((await db.collection('pickupHandovers').get()).empty).toBe(true);
 proofStorage.beforeMetadata=null;await db.collection('jobs').doc('ceramic').update({paymentStatus:'paid'});
 expect(await recordPickupHandover.run(request(proof))).toEqual({recorded:true,idempotent:false});
 await db.collection('jobs').doc('ceramic').update({status:'IN_PROGRESS'});expect(await recordPickupHandover.run(request(proof))).toEqual({recorded:true,idempotent:true});expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('READY_FOR_DELIVERY');
 await db.collection('pickupRequests').doc('ceramic').set({id:'ceramic',bookingId:'ceramic',tenantId:'t',studioId:'s',customerId:'c',status:'CONFIRMED',kind:'pickup'});
 await expect(issuePickupHandoverPhotoUploadUrl.run(request({requestId:'ceramic',leg:'pickup',contentType:'image/jpeg'}))).rejects.toThrow('existing pickup');
 await expect(recordPickupHandover.run(request({requestId:'ceramic',leg:'pickup',driverName:'Driver B',odometerKm:100,photoPaths:['t/pickupProof/ceramic/pickup/abc.jpg']}))).rejects.toThrow('existing pickup');
 expect((await db.collection('pickupHandovers').get()).size).toBe(1);expect((await db.collection('payments').get()).empty).toBe(true);
 await db.collection('pickupRequests').doc('wash').update({status:'DONE'});expect(await getPickupHandover.run(request({requestId:'wash',leg:'drop'}))).toMatchObject({record:{driverName:'Driver A',photoCount:1}});
});

async function thirdService(id='lamp'){
 const current=(await db.collection('jobs').doc('wash').get()).data()!;const{visitId,...rest}=current;
 await db.collection('jobs').doc(id).set({...rest,id,serviceId:id,lines:[{serviceId:id,name:id}],updatedAt:'new-service'});
}
it('adding another service reviews the full existing visit and preserves original jobs and financial snapshots',async()=>{
 const joined=await joinVisit.run(request(data()));await thirdService();const{getVisitJoinOptions}=await import('../../functions/visit/getVisitJoinOptions.js');const options:any=await getVisitJoinOptions.run(request({jobId:'wash'}));
 expect(options).toMatchObject({existingVisit:{visitId:joined.visitId,expectedRevision:1},members:[{jobId:'wash'},{jobId:'ceramic'}],options:[{jobId:'lamp'}]});
 const before=await Promise.all(['wash','ceramic','lamp'].map(async id=>(await db.collection('jobs').doc(id).get()).data()!));
 const input={operationId:randomUUID(),confirmed:true,existingVisit:options.existingVisit,members:[...options.members,...options.options].map((m:any)=>({jobId:m.jobId,expectedUpdatedAt:m.expectedUpdatedAt}))};
 expect(await joinVisit.run(request(input))).toEqual({visitId:joined.visitId,alreadyJoined:false});expect(await joinVisit.run(request(input))).toEqual({visitId:joined.visitId,alreadyJoined:true});
 expect((await db.collection('carVisits').doc(joined.visitId).get()).data()).toMatchObject({revision:2,jobIds:['wash','ceramic','lamp']});
 for(const[id,index]of[['wash',0],['ceramic',1],['lamp',2]]as const){const{visitId,updatedAt,...after}=(await db.collection('jobs').doc(id).get()).data()!,{visitId:old,updatedAt:oldTime,...prior}=before[index]!;expect(after).toEqual(prior);expect(visitId).toBe(joined.visitId)}
 expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('invoices').get()).empty).toBe(true);
});
it('concurrent additions cannot overwrite membership; only exact current revision can add',async()=>{
 const joined=await joinVisit.run(request(data()));await thirdService();await thirdService('tyre');const base=await reviewMembers();
 const add=(jobId:string)=>joinVisit.run(request({operationId:randomUUID(),confirmed:true,existingVisit:{visitId:joined.visitId,expectedRevision:1},members:[...base.map(({recordedWork,...m})=>m),{jobId,expectedUpdatedAt:'new-service'}]}));
 const results=await Promise.allSettled([add('lamp'),add('tyre')]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const visit=(await db.collection('carVisits').doc(joined.visitId).get()).data()!;expect(visit.revision).toBe(2);expect(visit.jobIds).toHaveLength(3);expect(visit.jobIds).toEqual(expect.arrayContaining(['wash','ceramic']));
 const rejected=visit.jobIds.includes('lamp')?'tyre':'lamp';expect((await db.collection('jobs').doc(rejected).get()).data()!.visitId).toBeUndefined();
});
it('omitting an existing member, stale revision or changing another group cannot reframe a visit',async()=>{
 const joined=await joinVisit.run(request(data()));await thirdService();const base=(await reviewMembers()).map(({recordedWork,...m})=>m);const exact={operationId:randomUUID(),confirmed:true,existingVisit:{visitId:joined.visitId,expectedRevision:1},members:[...base,{jobId:'lamp',expectedUpdatedAt:'new-service'}]};
 await expect(joinVisit.run(request({...exact,members:[base[0],exact.members[2]]}))).rejects.toThrow('Existing visit changed');
 await expect(joinVisit.run(request({...exact,existingVisit:{...exact.existingVisit,expectedRevision:2}}))).rejects.toThrow('Existing visit changed');
 await db.collection('jobs').doc('lamp').update({visitId:'another'});await expect(joinVisit.run(request(exact))).rejects.toThrow('Existing visit changed');expect((await db.collection('carVisits').doc(joined.visitId).get()).data()!.revision).toBe(1);
});
it('a frozen shared handover cannot silently gain another service',async()=>{
 const{start}=await readyHandover();await thirdService();const base=(await reviewMembers()).map(({recordedWork,...m})=>m);
 await expect(joinVisit.run(request({operationId:randomUUID(),confirmed:true,existingVisit:{visitId:start.visitId,expectedRevision:1},members:[...base,{jobId:'lamp',expectedUpdatedAt:'new-service'}]}))).rejects.toThrow('Existing visit changed');expect((await db.collection('jobs').doc('lamp').get()).data()!.visitId).toBeUndefined();
});
it('job-only shared membership is held before office cancellation touches a provider or financial branch',async()=>{
 const joined=await joinVisit.run(request(data()));await attachBookings(joined.visitId);
 await db.collection('bookings').doc('wash').update({visitId:null,combinedPayment:{malformed:'must never be consumed'}});
 await db.collection('jobs').doc('wash').update({status:'PENDING_VEHICLE'});
 await db.collection('payments').doc('open').set({id:'open',jobId:'wash',bookingId:'wash',tenantId:'t',studioId:'s',customerId:'c',method:'razorpay_payment_link',status:'pending',razorpayPaymentLinkId:'local-synthetic'});
 const before=(await db.collection('payments').doc('open').get()).data();
 const {adminCancelBooking}=await import('../../functions/booking/adminCancelBooking.js');
 const provider=await import('../../lib/razorpay-provider.js');const providerSpy=vi.spyOn(provider,'getPaymentProvider').mockImplementation(()=>{throw new Error('Unexpected provider access')});
 try{await expect(adminCancelBooking.run(request({bookingId:'wash',reason:'local cancellation check',feeAction:'waive'},'admin'))).rejects.toThrow('shared visit');expect(providerSpy).not.toHaveBeenCalled();}finally{providerSpy.mockRestore()}
 expect((await db.collection('payments').doc('open').get()).data()).toEqual(before);
 expect((await db.collection('bookings').doc('wash').get()).data()!.status).toBe('CONFIRMED');
 expect((await db.collection('jobs').doc('ceramic').get()).data()!.status).toBe('READY_FOR_DELIVERY');
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('receipt-funded direct cancellation rechecks a shared transport owner before any obligation or history write',async()=>{
 const joined=await joinVisit.run(request(data()));await attachBookings(joined.visitId);
 await db.collection('carVisits').doc(joined.visitId).update({transportJobId:'wash'});
 await db.collection('bookings').doc('wash').update({totalAmount:10000});
 await db.collection('jobs').doc('wash').update({status:'PENDING_VEHICLE',offlineSettlement:{appliedPaise:1000,officeReturnDuePaise:0,receiptCount:1}});
 const {cancelOfflineVisit}=await import('../../lib/offline-cancel.js');
 await expect(cancelOfflineVisit({uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}} as any,{bookingId:'wash',reason:'local test',feeAction:'waive'},'admin')).rejects.toThrow('pickup and drop');
 expect((await db.collection('offlineReturnObligations').get()).empty).toBe(true);expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('PENDING_VEHICLE');
});
it('waiting cancellation excludes a seemingly paid service from a new shared visit and invalidates a ready projection',async()=>{
 for(const id of ['wash','ceramic']){await db.collection('jobs').doc(id).update({bookingId:id});await db.collection('bookings').doc(id).set({id,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'v',status:'CONFIRMED'});}
 await db.collection('bookings').doc('wash').update({cancelIntent:{state:'needs_review'}});
 await expect(joinVisit.run(request(data()))).rejects.toThrow('cancellation pending');expect((await db.collection('carVisits').get()).empty).toBe(true);
 await db.collection('bookings').doc('wash').update({cancelIntent:null});await joinVisit.run(request(data()));
 await db.collection('bookings').doc('wash').update({cancelIntent:{state:'waiting'}});await expect(getStaffVisit.run(request({jobId:'ceramic'}))).rejects.toThrow('Visit needs review');
});

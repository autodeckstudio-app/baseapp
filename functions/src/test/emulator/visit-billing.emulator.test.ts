import{it,expect,beforeAll,afterAll,beforeEach}from'vitest';import{initializeTestEnvironment,type RulesTestEnvironment}from'@firebase/rules-unit-testing';import{getFirestore,FieldValue}from'firebase-admin/firestore';import{readFileSync}from'node:fs';import{resolve}from'node:path';import{TEST_PROJECT_ID}from'../emulator-setup';import{getMyVisitBill,getStaffVisitBill}from'../../functions/visit/getVisitBill';
const db=getFirestore();let env:RulesTestEnvironment;const request=(data:any,role='admin',uid='staff')=>({data,auth:{uid,token:{role,tenantId:'t',studioId:'s'}}}as any);
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:TEST_PROJECT_ID,firestore:{host:'127.0.0.1',port:Number(process.env.FIRESTORE_EMULATOR_TEST_PORT),rules:readFileSync(resolve(__dirname,'../../../../firestore.rules'),'utf8')}})});afterAll(async()=>env.cleanup());
// The emulator can retain a just-aborted read lock briefly. Retry only the
// fixture reset, never the workflow or an assertion. Real failures still fail.
async function resetFixture(){for(let attempt=0;;attempt++){try{await env.clearFirestore();return}catch(error){if(attempt>=2||!String(error).includes('Transaction lock timeout'))throw error;await new Promise(r=>setTimeout(r,300));}}}
beforeEach(async()=>{await resetFixture();await db.collection('studioConfig').doc('s').set({tenantId:'t',invoiceIssuer:{tradeName:'Test Studio',legalName:'Test Studio Legal',address:'Test address',phone:'0000000000',email:'test@example.invalid',gstRegistered:false,gstin:null}});await db.collection('customers').doc('c').set({id:'c',name:'Test Customer',tenantId:'t',authUid:'customer',deletedAt:null});await db.collection('vehicles').doc('car').set({id:'car',tenantId:'t',ownerId:'c',registrationNumber:'TEST CAR',make:'Test',model:'Vehicle',color:'White',year:2025,deletedAt:null});await db.collection('carVisits').doc('v').set({id:'v',tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',revision:1,jobIds:['wash','interior'],transportJobId:null,createdAt:'old',createdBy:'u',updatedAt:'old',updatedBy:'u'});for(const[id,total]of[['wash',120000],['interior',240000]]as const){await db.collection('services').doc(id).set({id,category:'washing'});await db.collection('bookings').doc('b_'+id).set({id:'b_'+id,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',serviceId:id,visitId:'v',status:'CONFIRMED',totalAmount:total,scheduledAt:new Date(Date.now()+3600000).toISOString()});await db.collection('jobs').doc(id).set({id,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',visitId:'v',bookingId:'b_'+id,serviceId:id,status:'PENDING_VEHICLE',paymentStatus:'unpaid',updatedAt:'old',scheduledDate:'2026-11-15',additionalWorkDelta:0,totalAmount:total,priceBreakdown:{total,basePrice:total,scopeAdjustment:0,tax:0,taxRatePercent:0,taxDescription:'No tax',membershipDiscount:0,membershipDiscountPercent:null,addOns:[],currency:'INR',pickupFee:0,dropFee:0},lines:[{serviceId:id,name:id}]});}});
const read=(data:any={visitId:'v'})=>getStaffVisitBill.run(request(data));
it('one itemized exact bill review is own-scoped, stable and writes no financial records',async()=>{const a:any=await read();expect(a).toMatchObject({totalPaise:360000,appliedPaise:0,balancePaise:360000,collectionEnabled:false,cancellationEnabled:false,lines:[{jobId:'wash',amountPaise:120000},{jobId:'interior',amountPaise:240000}]});expect(await read()).toEqual(a);expect(await getMyVisitBill.run(request({visitId:'v'},'customer','customer'))).toEqual(a);for(const c of['payments','offlineReceipts','invoices','visitReceipts','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);await db.collection('customers').doc('other').set({id:'other',authUid:'stranger',tenantId:'t'});await expect(getMyVisitBill.run(request({visitId:'v'},'customer','stranger'))).rejects.toBeDefined();await expect(getStaffVisitBill.run(request({visitId:'v'},'accountant'))).rejects.toBeDefined()});
it('owner correction: removing one service has zero fee, final remaining service invokes existing window',async()=>{expect(await read({visitId:'v',cancelJobId:'wash'})).toMatchObject({cancellation:{feePaise:0,reason:'another_service_continues'}});await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});expect(await read({visitId:'v',cancelJobId:'wash'})).toMatchObject({totalPaise:120000,cancellation:{feePaise:10000,reason:'last_service_policy'}});await db.collection('bookings').doc('b_wash').update({scheduledAt:new Date(Date.now()+8*3600000).toISOString()});expect(await read({visitId:'v',cancelJobId:'wash'})).toMatchObject({cancellation:{feePaise:0,reason:'last_service_policy'}})});
it('explicit later join and approved additions change the review without rewriting old obligations',async()=>{const a:any=await read();await db.collection('approvals').doc('a').set({id:'a',tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',jobId:'wash',status:'approved',priceImpact:5000});await db.collection('jobs').doc('wash').update({totalAmount:125000,additionalWorkDelta:5000});const b:any=await read();expect(b.totalPaise).toBe(365000);expect(b.reviewToken).not.toBe(a.reviewToken);await db.collection('jobs').doc('extra').set({...((await db.collection('jobs').doc('wash').get()).data()),id:'extra',bookingId:null,additionalWorkDelta:0,totalAmount:70000,priceBreakdown:{total:70000,tax:0,currency:'INR',pickupFee:0,dropFee:0}});await db.collection('carVisits').doc('v').update({jobIds:['wash','interior','extra'],revision:2});const c:any=await read();expect(c).toMatchObject({revision:2,totalPaise:435000});expect(c.reviewToken).not.toBe(b.reviewToken)});
const payment={id:'p',tenantId:'t',studioId:'s',customerId:'c',targetType:'job',jobId:'wash',bookingId:'b_wash',currency:'INR',method:'cash',status:'completed',amount:120000,invoiceId:'i'};
async function paid(){await db.collection('payments').doc('p').set(payment);await db.collection('jobs').doc('wash').update({paymentStatus:'paid',invoiceId:'i'});await db.collection('invoices').doc('i').set({id:'i',tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',jobId:'wash',status:'issued',currency:'INR',paymentId:'p',total:120000,subtotal:120000,discount:0,tax:0,invoiceNumber:'INV-ORIGINAL'});}
it('verified paid original invoice is shown and never collected again',async()=>{await paid();const prior=(await db.collection('invoices').doc('i').get()).data();expect(await read()).toMatchObject({totalPaise:360000,appliedPaise:120000,balancePaise:240000,lines:expect.arrayContaining([expect.objectContaining({jobId:'wash',invoiceNumber:'INV-ORIGINAL',appliedPaise:120000})])});expect((await db.collection('invoices').doc('i').get()).data()).toEqual(prior)});
it('partial actual cash receipts count once, without a manufactured completed payment',async()=>{await db.collection('offlineReceipts').doc('r').set({id:'r',tenantId:'t',studioId:'s',customerId:'c',jobId:'wash',bookingId:'b_wash',receivedPaise:20000,appliedPaise:20000,officeReturnDuePaise:0,method:'cash'});await db.collection('jobs').doc('wash').update({paymentStatus:'partial',offlineSettlement:{appliedPaise:20000,officeReturnDuePaise:0,receiptCount:1}});expect(await read()).toMatchObject({appliedPaise:20000,balancePaise:340000});expect((await db.collection('payments').get()).empty).toBe(true)});
it.each([{status:'pending'},{status:'partially_refunded'},{status:'refunded'},{currency:'USD'},{customerId:'other'},{amount:120001},{refundAmount:1},{overpayments:[{amount:1}]},{targetType:'membership'},{invoiceReviewNeeded:true}])('payment anomaly %j never produces a false collectable balance',async patch=>{await paid();await db.collection('payments').doc('p').update(patch);await expect(read()).rejects.toBeDefined()});
it.each([{visitId:'other'},{customerId:'other'},{totalAmount:1},{cashReconciliationId:'held'},{additionalWorkDelta:1},{paymentStatus:'paid'}])('job anomaly %j fails closed',async patch=>{await db.collection('jobs').doc('wash').update(patch);await expect(read()).rejects.toBeDefined()});
it('receipt projection is not a second collection and original invoice scope is immutable',async()=>{await paid();await db.collection('payments').doc('p').update({offlineReceiptSettlement:true});await db.collection('jobs').doc('wash').update({offlineSettlement:{appliedPaise:120000,officeReturnDuePaise:0,receiptCount:1}});await db.collection('offlineReceipts').doc('r').set({tenantId:'t',studioId:'s',customerId:'c',jobId:'wash',bookingId:'b_wash',receivedPaise:120000,appliedPaise:120000,officeReturnDuePaise:0,method:'cash'});expect(await read()).toMatchObject({appliedPaise:120000});await db.collection('invoices').doc('i').update({vehicleId:'other'});await expect(read()).rejects.toBeDefined()});
it('cancelled service with unresolved money, an open approval or changed refund history stays in review',async()=>{await paid();await db.collection('jobs').doc('wash').update({status:'CANCELLED'});await db.collection('bookings').doc('b_wash').update({status:'CANCELLED'});await expect(read()).rejects.toBeDefined();await db.collection('jobs').doc('wash').update({status:'PENDING_VEHICLE'});await db.collection('bookings').doc('b_wash').update({status:'CONFIRMED'});await db.collection('refundRequests').doc('rr').set({paymentId:'p',status:'reserved'});await expect(read()).rejects.toBeDefined();await db.collection('refundRequests').doc('rr').delete();await db.collection('approvals').doc('a').set({jobId:'wash',status:'pending'});await expect(read()).rejects.toBeDefined()});

it('partial allocation review uses approved proportional rule and does not write a receipt',async()=>{const r:any=await read({visitId:'v',receiptPaise:72000});expect(r.allocation.entries).toEqual([{jobId:'interior',appliedPaise:48000},{jobId:'wash',appliedPaise:24000}]);expect((await db.collection('offlineReceipts').get()).empty).toBe(true)});
it('a newly recorded partial receipt invalidates the review token and only remaining balances receive another part',async()=>{const prior:any=await read();await db.collection('offlineReceipts').doc('r').set({tenantId:'t',studioId:'s',customerId:'c',jobId:'wash',bookingId:'b_wash',receivedPaise:60000,appliedPaise:60000,officeReturnDuePaise:0,method:'cash'});await db.collection('jobs').doc('wash').update({paymentStatus:'partial',offlineSettlement:{appliedPaise:60000,officeReturnDuePaise:0,receiptCount:1}});const next:any=await read({visitId:'v',receiptPaise:60000});expect(next.reviewToken).not.toBe(prior.reviewToken);expect(next.allocation.entries).toEqual([{jobId:'interior',appliedPaise:48000},{jobId:'wash',appliedPaise:12000}]);});
it('foreign studio, duplicated membership and multiple charged transport scopes never produce a payable review',async()=>{await expect(getStaffVisitBill.run({...request({visitId:'v'},'studio'),auth:{uid:'staff',token:{role:'studio',tenantId:'t',studioId:'other'}}}as any)).rejects.toBeDefined();await db.collection('carVisits').doc('v').update({jobIds:['wash','wash']});await expect(read()).rejects.toBeDefined();await db.collection('carVisits').doc('v').update({jobIds:['wash','interior'],transportJobId:'wash'});for(const j of['wash','interior'])await db.collection('jobs').doc(j).update({'priceBreakdown.pickupFee':100});await expect(read()).rejects.toBeDefined()});
async function prepare(token:string,operationId?:string){const{prepareVisitBill}=await import('../../functions/visit/prepareVisitBill.js');const{randomUUID}=await import('node:crypto');return prepareVisitBill.run(request({visitId:'v',reviewToken:token,operationId:operationId??randomUUID(),confirmed:true}));}
it('one exact review produces a single immutable collection bill and retry never creates money or rewrites original invoices',async()=>{await paid();const r:any=await read(),{randomUUID}=await import('node:crypto'),key=randomUUID(),made:any=await prepare(r.reviewToken,key);expect(await prepare(r.reviewToken,key)).toEqual({...made,alreadyPrepared:true});const stored=(await db.collection('visitBills').doc(made.billId).get()).data()!;expect(stored).toMatchObject({kind:'visit_collection_bill',status:'prepared',totalPaise:360000,previouslyAppliedPaise:120000,payablePaise:240000,revision:1});expect(stored.lines[0]).toMatchObject({invoiceNumber:'INV-ORIGINAL'});expect((await db.collection('visitBills').get()).size).toBe(1);expect((await db.collection('invoices').doc('i').get()).data()!.total).toBe(120000);expect((await db.collection('payments').get()).size).toBe(1);expect((await db.collection('offlineReceipts').get()).empty).toBe(true)});
it('changed approved addition invalidates a prior review and creates a new linked bill without editing the prior one',async()=>{const a:any=await read(),first:any=await prepare(a.reviewToken),before=(await db.collection('visitBills').doc(first.billId).get()).data();await db.collection('approvals').doc('a').set({id:'a',tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',jobId:'wash',status:'approved',priceImpact:5000});await db.collection('jobs').doc('wash').update({totalAmount:125000,additionalWorkDelta:5000});await expect(prepare(a.reviewToken)).rejects.toThrow('changed');const b:any=await read(),second:any=await prepare(b.reviewToken);expect((await db.collection('visitBills').doc(second.billId).get()).data()).toMatchObject({revision:2,previousBillId:first.billId,totalPaise:365000});expect((await db.collection('visitBills').doc(first.billId).get()).data()).toEqual(before)});
it('concurrent identical bill preparation has one snapshot and one head revision',async()=>{const a:any=await read();await Promise.all([prepare(a.reviewToken),prepare(a.reviewToken)]);expect((await db.collection('visitBills').get()).size).toBe(1);expect((await db.collection('visitBillHeads').doc('v').get()).data()!.revision).toBe(1)});
it('handover freeze and reused operation with a different payload cannot prepare another bill',async()=>{const a:any=await read(),{randomUUID}=await import('node:crypto'),key=randomUUID();await prepare(a.reviewToken,key);await expect(prepare('a'.repeat(64),key)).rejects.toMatchObject({code:'already-exists'});await db.collection('carVisits').doc('v').update({activeHandoverId:'frozen'});const b:any=await read();await expect(prepare(b.reviewToken)).rejects.toThrow('changed');expect((await db.collection('visitBills').get()).size).toBe(1)});
async function cancelService(jobId:string,token:string,operationId?:string,role='admin'){const{cancelVisitService}=await import('../../functions/visit/cancelVisitService.js');const{randomUUID}=await import('node:crypto');return cancelVisitService.run(request({visitId:'v',jobId,reviewToken:token,operationId:operationId??randomUUID(),expectedFeePaise:(await db.collection('bookings').doc('b_'+jobId).get()).data()?.cancellationFeePaise??((await read({visitId:'v',cancelJobId:jobId})) as any).cancellation.feePaise,reason:'Customer changed selected work',confirmed:true},role));}
it('unfunded service cancellation has no fee while another service goes ahead, and changes no other work or money',async()=>{const a:any=await read(),before=(await db.collection('jobs').doc('interior').get()).data(),{randomUUID}=await import('node:crypto'),key=randomUUID(),result:any=await cancelService('wash',a.reviewToken,key);expect(result).toMatchObject({feePaise:0,feeReason:'another_service_continues',revision:2});expect(await cancelService('wash',a.reviewToken,key)).toEqual({...result,alreadyCancelled:true});expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(before);expect((await db.collection('bookings').doc('b_wash').get()).data()).toMatchObject({status:'CANCELLED',cancellationFeePaise:0,cancellationFeeStatus:'none'});expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('invoices').get()).empty).toBe(true)});
it('final service uses existing fee window, not an unconditional fee',async()=>{const first:any=await read();await cancelService('wash',first.reviewToken);const second:any=await read();expect(await cancelService('interior',second.reviewToken)).toMatchObject({feePaise:10000,feeReason:'last_service_policy'});expect((await db.collection('bookings').doc('b_interior').get()).data()).toMatchObject({cancellationFeePaise:10000,cancellationFeeStatus:'due'});});
it('simultaneous removal cannot waive the final service from an obsolete membership review',async()=>{const a:any=await read(),results=await Promise.allSettled([cancelService('wash',a.reviewToken),cancelService('interior',a.reviewToken)]);expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect((await db.collection('jobs').get()).docs.filter(d=>d.data().status==='CANCELLED')).toHaveLength(1);const next:any=await read(),remaining=next.lines.find((l:any)=>!l.cancelled);expect(await cancelService(remaining.jobId,next.reviewToken)).toMatchObject({feePaise:10000});});
it('another paid service keeps its original receipt, invoice and work when the unpaid service is removed',async()=>{await paid();const p=(await db.collection('payments').doc('p').get()).data(),i=(await db.collection('invoices').doc('i').get()).data(),a:any=await read();expect(await cancelService('interior',a.reviewToken)).toMatchObject({feePaise:0});expect((await db.collection('payments').doc('p').get()).data()).toEqual(p);expect((await db.collection('invoices').doc('i').get()).data()).toEqual(i);expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('PENDING_VEHICLE')});
it('funded cancellation, transport owner, benefit and non-Admin paths stay held without partial changes',async()=>{await paid();const a:any=await read();await expect(cancelService('wash',a.reviewToken)).rejects.toThrow('return review');await expect(cancelService('interior',a.reviewToken,undefined,'studio')).rejects.toMatchObject({code:'permission-denied'});await db.collection('bookings').doc('b_interior').update({membershipId:'m'});const b:any=await read();await expect(cancelService('interior',b.reviewToken)).rejects.toThrow('benefit');await db.collection('bookings').doc('b_interior').update({membershipId:null});await db.collection('carVisits').doc('v').update({transportJobId:'interior'});const c:any=await read();await expect(cancelService('interior',c.reviewToken)).rejects.toThrow('transport');expect((await db.collection('jobs').get()).docs.every(d=>d.data().status==='PENDING_VEHICLE')).toBe(true);expect((await db.collection('visitCancellationReceipts').get()).empty).toBe(true)});
it('an unpaid final cancellation fee is held for its existing settlement flow, never hidden as a zero visit balance',async()=>{const a:any=await read();await cancelService('wash',a.reviewToken);const b:any=await read();await cancelService('interior',b.reviewToken);await expect(read()).rejects.toThrow('fee settlement');});
async function receiptReady(){for(const jobId of['wash','interior'])await db.collection('jobs').doc(jobId).update({status:'VEHICLE_RECEIVED'});const r:any=await read(),b:any=await prepare(r.reviewToken);return{r,b};}
async function recordVisit(r:any,b:any,patch:any={},role='admin'){const{recordVisitReceipt}=await import('../../functions/visit/recordVisitReceipt.js');const{randomUUID}=await import('node:crypto');return recordVisitReceipt.run(request({visitId:'v',billId:b.billId,reviewToken:r.reviewToken,operationId:randomUUID(),receivedPaise:72000,method:'cash',reference:'Actual cash handover',confirmActualReceipt:true,...patch},role));}
it('one actual partial visit receipt allocates proportionally, updates both balances and does not fabricate completed payments or invoices',async()=>{const{r,b}=await receiptReady(),result:any=await recordVisit(r,b);expect(result).toMatchObject({receivedPaise:72000,appliedPaise:72000,balancePaise:288000,entries:[{jobId:'interior',appliedPaise:48000},{jobId:'wash',appliedPaise:24000}]});expect((await db.collection('visitReceipts').get()).size).toBe(1);expect((await db.collection('offlineReceipts').get()).size).toBe(2);expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('invoices').get()).empty).toBe(true);expect(await read()).toMatchObject({appliedPaise:72000,balancePaise:288000});});
it('lost-response receipt retry returns the same receipt and changed payload cannot reuse its identity',async()=>{const{r,b}=await receiptReady(),{randomUUID}=await import('node:crypto'),key=randomUUID(),first:any=await recordVisit(r,b,{operationId:key});expect(await recordVisit(r,b,{operationId:key})).toEqual({...first,alreadyRecorded:true});await expect(recordVisit(r,b,{operationId:key,receivedPaise:70000})).rejects.toMatchObject({code:'already-exists'});expect((await db.collection('visitReceipts').get()).size).toBe(1);});
it('simultaneous actual receipts from an identical bill cannot both use the stale funding review',async()=>{const{r,b}=await receiptReady(),results=await Promise.allSettled([recordVisit(r,b),recordVisit(r,b)]);expect(results.filter(r=>r.status==='fulfilled'&&!(r.value as any).rejected)).toHaveLength(1);expect(results.filter(r=>r.status==='fulfilled'&&(r.value as any).rejected)).toHaveLength(1);expect((await db.collection('visitReceiptAttempts').get()).size).toBe(1);expect((await db.collection('visitReceipts').get()).size).toBe(1);expect(await read()).toMatchObject({appliedPaise:72000});});
it('a second proportional receipt uses only the remaining balance and keeps the first original receipt unchanged',async()=>{const{r,b}=await receiptReady(),first:any=await recordVisit(r,b),original=(await db.collection('visitReceipts').doc(first.receiptId).get()).data(),next:any=await read(),nextBill:any=await prepare(next.reviewToken);expect(await recordVisit(next,nextBill,{receivedPaise:36000})).toMatchObject({balancePaise:252000,entries:[{jobId:'interior',appliedPaise:24000},{jobId:'wash',appliedPaise:12000}]});expect((await db.collection('visitReceipts').doc(first.receiptId).get()).data()).toEqual(original);expect(await read()).toMatchObject({appliedPaise:108000});});
it('overpayment, unarrived services and unsupported role cannot partially mutate money',async()=>{let x=await receiptReady();for(const receivedPaise of[360001])await expect(recordVisit(x.r,x.b,{receivedPaise})).rejects.toThrow('Excess money');await expect(recordVisit(x.r,x.b,{method:'upi_manual'},'studio')).rejects.toMatchObject({code:'permission-denied'});await expect(recordVisit(x.r,x.b,{},'customer')).rejects.toMatchObject({code:'permission-denied'});await db.collection('jobs').doc('wash').update({status:'PENDING_VEHICLE'});const r:any=await read(),b:any=await prepare(r.reviewToken);await expect(recordVisit(r,b)).rejects.toThrow('service needs');expect((await db.collection('visitReceipts').get()).empty).toBe(true);expect((await db.collection('offlineReceipts').get()).empty).toBe(true);});
it('orphaned or changed visit receipt application never becomes received money in the bill',async()=>{const{r,b}=await receiptReady(),result:any=await recordVisit(r,b);await db.collection('visitReceipts').doc(result.receiptId).update({receivedPaise:72001});await expect(read()).rejects.toThrow('receipt');await db.collection('visitReceipts').doc(result.receiptId).delete();await expect(read()).rejects.toThrow('receipt');});
it('one full actual receipt issues one consolidated invoice for two previously unissued services, never two job invoices',async()=>{const{r,b}=await receiptReady(),result:any=await recordVisit(r,b,{receivedPaise:360000});expect(result).toMatchObject({balancePaise:0,receivedPaise:360000});expect(typeof result.invoiceId).toBe('string');expect((await db.collection('invoices').get()).empty).toBe(true);expect((await db.collection('payments').get()).empty).toBe(true);const vi=(await db.collection('visitInvoices').doc(result.invoiceId).get()).data()!;expect(vi).toMatchObject({kind:'shared_visit_invoice',totalPaise:360000,subtotalPaise:360000,discountPaise:0,taxPaise:0,roundOffPaise:0,sharedVisitId:'v',jobIds:['wash','interior']});expect(vi.invoiceNumber).toMatch(/^INV-/);expect(await read()).toMatchObject({balancePaise:0,appliedPaise:360000,lines:[{invoiceId:result.invoiceId,invoiceNumber:vi.invoiceNumber},{invoiceId:result.invoiceId,invoiceNumber:vi.invoiceNumber}]});});
it('final balance after partial collections produces one full obligation invoice and retains every original receipt',async()=>{const{r,b}=await receiptReady();await recordVisit(r,b);const next:any=await read(),nextBill:any=await prepare(next.reviewToken),final:any=await recordVisit(next,nextBill,{receivedPaise:288000});expect((await db.collection('visitReceipts').get()).size).toBe(2);expect((await db.collection('visitInvoices').get()).size).toBe(1);expect((await db.collection('visitInvoices').doc(final.invoiceId).get()).data()).toMatchObject({totalPaise:360000});expect(await read()).toMatchObject({appliedPaise:360000,balancePaise:0});});
it('an old paid issued invoice is preserved and excluded from new consolidated invoice revenue',async()=>{await paid();await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});const original=(await db.collection('invoices').doc('i').get()).data(),r:any=await read(),b:any=await prepare(r.reviewToken),result:any=await recordVisit(r,b,{receivedPaise:240000});expect((await db.collection('visitInvoices').doc(result.invoiceId).get()).data()).toMatchObject({totalPaise:240000,jobIds:['interior']});expect((await db.collection('invoices').doc('i').get()).data()).toEqual(original);expect(await read()).toMatchObject({totalPaise:360000,appliedPaise:360000,balancePaise:0});});
it('consolidated invoice mutation or missing final receipt is a review hold, never a paid bill',async()=>{const{r,b}=await receiptReady(),result:any=await recordVisit(r,b,{receivedPaise:360000});await db.collection('visitInvoices').doc(result.invoiceId).update({taxPaise:1});await expect(read()).rejects.toThrow('invoice');await db.collection('visitInvoices').doc(result.invoiceId).update({taxPaise:0});await db.collection('visitReceipts').doc(result.receiptId).delete();await expect(read()).rejects.toThrow('receipt');});
it('new invoice preserves each original tax snapshot rather than applying a current blended or guessed rate',async()=>{await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED',totalAmount:118000,priceBreakdown:{basePrice:100000,scopeAdjustment:0,addOns:[],membershipDiscount:0,membershipDiscountPercent:null,pickupFee:0,dropFee:0,taxRatePercent:18,taxDescription:'GST 18%',tax:18000,total:118000,currency:'INR'}});await db.collection('bookings').doc('b_wash').update({totalAmount:118000});await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});const r:any=await read(),b:any=await prepare(r.reviewToken),result:any=await recordVisit(r,b,{receivedPaise:358000}),ref=db.collection('visitInvoices').doc(result.invoiceId),vi=(await ref.get()).data()!;expect(vi).toMatchObject({totalPaise:358000,subtotalPaise:340000,taxPaise:18000,components:[{taxRatePercent:18,taxPaise:18000},{taxRatePercent:0,taxPaise:0}]});expect(await read()).toMatchObject({balancePaise:0});vi.components[0].taxRatePercent=0;await ref.update({components:vi.components});await expect(read()).rejects.toThrow('snapshot');});
it('bad invoice counter or missing customer snapshot fails atomically before a receipt, invoice or counter write',async()=>{const{r,b}=await receiptReady();await db.collection('invoiceCounters').doc('t').set({tenantId:'other',nextNumber:1,year:2026});await expect(recordVisit(r,b,{receivedPaise:360000})).rejects.toThrow('sequence');expect((await db.collection('visitReceipts').get()).empty).toBe(true);expect((await db.collection('visitInvoices').get()).empty).toBe(true);await db.collection('invoiceCounters').doc('t').delete();await db.collection('customers').doc('c').update({name:''});const next:any=await read(),nextBill:any=await prepare(next.reviewToken);await expect(recordVisit(next,nextBill,{receivedPaise:360000})).rejects.toThrow('snapshot');expect((await db.collection('invoiceCounters').get()).empty).toBe(true);});
it('shared invoice settlement is accepted by the handover invoice guard without fake legacy records',async()=>{const{r,b}=await receiptReady();await recordVisit(r,b,{receivedPaise:360000});const{assertVisitMemberInvoice}=await import('../../lib/visit-invoice-settlement.js');await db.runTransaction(async tx=>{for(const id of['wash','interior']){const j=(await tx.get(db.collection('jobs').doc(id))).data()as any;await assertVisitMemberInvoice(tx,db,j);}});expect((await db.collection('invoices').get()).empty).toBe(true);});
it('legacy one-job entry points cannot split the reviewed shared bill or create competing money records',async()=>{const{recordManualPayment}=await import('../../functions/payment/recordManualPayment.js'),{recordOfflineReceipt}=await import('../../functions/payment/recordOfflineReceipt.js'),{initiatePayment}=await import('../../functions/payment/initiatePayment.js');await expect(recordManualPayment.run(request({jobId:'wash',method:'cash'}))).rejects.toThrow('visit bill');await expect(recordOfflineReceipt.run(request({jobId:'wash',receiptKey:'legacy_receipt_key_123',receivedPaise:1000,method:'cash'}))).rejects.toThrow('visit receipt');await expect(initiatePayment.run(request({jobId:'wash',method:'razorpay_payment_link'}))).rejects.toThrow('visit bill');for(const collection of['payments','offlineReceipts','visitReceipts','invoices','visitInvoices'])expect((await db.collection(collection).get()).empty,collection).toBe(true);});
it('one final shared receipt connects through real recorded-work handover and both guarded job deliveries without legacy invoices',async()=>{const{recordJobPerformedWork}=await import('../../functions/work/recordJobPerformedWork.js'),{startVisitHandover}=await import('../../functions/visit/startVisitHandover.js'),{completeVisitHandover}=await import('../../functions/visit/completeVisitHandover.js'),{visitWorkReview}=await import('../../lib/visit-work-review.js'),{randomUUID}=await import('node:crypto');for(const id of['wash','interior']){await db.collection('jobs').doc(id).update({status:'READY_FOR_DELIVERY',statusHistory:[],bayId:'',createdAt:new Date().toISOString(),scheduledAt:new Date().toISOString(),estimatedEndAt:new Date().toISOString(),estimatedEndDate:'2026-11-15',estimatedDurationMinutes:60,isWalkIn:false,assignedEmployeeId:null,sealedAt:null});await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:0,action:'record',lineId:'booked-0',approvalId:null,performed:true,work:{kind:'service'}}));await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:1,action:'qc',lineId:'booked-0',checked:true}));await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:2,action:'seal',confirmed:true}));}const r:any=await read(),b:any=await prepare(r.reviewToken);await recordVisit(r,b,{receivedPaise:360000});const members=await Promise.all(['wash','interior'].map(async jobId=>({jobId,expectedUpdatedAt:(await db.collection('jobs').doc(jobId).get()).data()!.updatedAt,recordedWork:visitWorkReview((await db.collection('jobPerformedWork').doc(jobId).get()).data())})));const manifest:any=await startVisitHandover.run(request({visitId:'v',expectedRevision:1,operationId:randomUUID(),confirmed:true,members}));expect(await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}))).toMatchObject({status:'complete',error:null});for(const id of['wash','interior'])expect((await db.collection('jobs').doc(id).get()).data()!.status).toBe('DELIVERED');expect((await db.collection('invoices').get()).empty).toBe(true);expect((await db.collection('visitInvoices').get()).size).toBe(1);expect(await read()).toMatchObject({balancePaise:0});});
it('reviewed cancellation fee must match the current time window and cannot silently increase at submission',async()=>{await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});const r:any=await read({visitId:'v',cancelJobId:'wash'});expect(r.cancellation.feePaise).toBe(10000);const{cancelVisitService}=await import('../../functions/visit/cancelVisitService.js'),{randomUUID}=await import('node:crypto');await expect(cancelVisitService.run(request({visitId:'v',jobId:'wash',reviewToken:r.reviewToken,operationId:randomUUID(),expectedFeePaise:0,reason:'Reviewed before cutoff',confirmed:true}))).rejects.toThrow('fee changed');expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('PENDING_VEHICLE');});
it('cancellation preview exposes funded and transport review holds before any destructive control is offered',async()=>{await paid();expect(await read({visitId:'v',cancelJobId:'wash'})).toMatchObject({cancellation:{feePaise:0,hold:expect.stringContaining('return review')}});await db.collection('carVisits').doc('v').update({transportJobId:'interior'});expect(await read({visitId:'v',cancelJobId:'interior'})).toMatchObject({cancellation:{feePaise:0,hold:expect.stringContaining('transport')}});});

it('issued shared invoice read and office history stay scoped and independent of later job changes',async()=>{const{getVisitInvoice,listStaffVisitInvoices}=await import('../../functions/visit/getVisitInvoice.js');const{r,b}=await receiptReady(),result:any=await recordVisit(r,b,{receivedPaise:360000});const original=(await db.collection('visitInvoices').doc(result.invoiceId).get()).data()!;const scoped=()=>getVisitInvoice.run(request({invoiceId:result.invoiceId}));const inv:any=await scoped();expect(inv).toMatchObject({id:result.invoiceId,totalPaise:360000,customerSnapshot:{name:'Test Customer'}});expect(await listStaffVisitInvoices.run(request({}))).toMatchObject({invoices:[{id:result.invoiceId,total:360000,status:'issued'}]});expect(await getVisitInvoice.run(request({invoiceId:result.invoiceId},'customer','customer'))).toEqual(inv);await db.collection('jobs').doc('wash').update({status:'CANCELLED',totalAmount:1});await db.collection('carVisits').doc('v').update({revision:99,jobIds:[]});expect(await scoped()).toEqual(inv);await db.collection('customers').doc('c').update({authUid:'different'});await expect(getVisitInvoice.run(request({invoiceId:result.invoiceId},'customer','customer'))).rejects.toBeDefined();expect((await db.collection('visitInvoices').doc(result.invoiceId).get()).data()).toEqual(original);expect((await db.collection('invoices').get()).empty).toBe(true);});
it('actual Studio partial and final cash receipts feed Daily Close and Accountant as two events and one issued original',async()=>{const{getAccountantMoney}=await import('../../functions/office/getAccountantMoney.js'),{dayAggregates}=await import('../../lib/dayAggregates.js');const{r,b}=await receiptReady();await recordVisit(r,b,{},'studio');const next:any=await read(),nextBill:any=await prepare(next.reviewToken),final:any=await recordVisit(next,nextBill,{receivedPaise:288000},'studio');const original=(await db.collection('visitInvoices').doc(final.invoiceId).get()).data()!;const day=new Date(original.issuedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});expect(await dayAggregates('t','s',day)).toMatchObject({cashPaise:360000,totalRevenuePaise:360000,paymentCount:2});const accountant:any=await getAccountantMoney.run(request({studioId:'s',month:day.slice(0,7)},'accountant'));expect(accountant.report).toMatchObject({totalReceiptsPaise:360000,cashPaise:360000,paymentCount:2});expect(accountant.invoices).toMatchObject([{id:final.invoiceId,total:360000,subtotal:360000,tax:0,taxRatePercent:0}]);expect(accountant.offlineReceipts).toHaveLength(4);expect(accountant.offlineReceipts[0]).not.toHaveProperty('jobId');expect(accountant.offlineReceipts[0]).not.toHaveProperty('actualReceiptId');expect(JSON.stringify(accountant)).not.toContain('Actual cash handover');expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('invoices').get()).empty).toBe(true);});
it('stale receipt is terminally rejected once and cannot revive even when the original bill returns',async()=>{const{r,b}=await receiptReady(),{randomUUID}=await import('node:crypto'),key=randomUUID();await db.collection('carVisits').doc('v').update({activeHandoverId:'frozen'});const rejected:any=await recordVisit(r,b,{operationId:key});expect(rejected).toMatchObject({rejected:true,reason:'bill_changed',command:{operationId:key,receivedPaise:72000}});expect((await db.collection('visitReceipts').get()).empty).toBe(true);expect((await db.collection('offlineReceipts').get()).empty).toBe(true);expect((await db.collection('visitReceiptAttempts').get()).size).toBe(1);await db.collection('carVisits').doc('v').update({activeHandoverId:FieldValue.delete()});expect(await recordVisit(r,b,{operationId:key})).toEqual(rejected);await expect(recordVisit(r,b,{operationId:key,receivedPaise:70000})).rejects.toMatchObject({code:'already-exists'});expect((await db.collection('visitReceipts').get()).empty).toBe(true);expect(await recordVisit(r,b)).toMatchObject({receivedPaise:72000,balancePaise:288000});});
it('concurrent retries of one stale operation have one terminal marker and never create money',async()=>{const{r,b}=await receiptReady(),{randomUUID}=await import('node:crypto'),key=randomUUID();await db.collection('carVisits').doc('v').update({revision:2});const results=await Promise.all([recordVisit(r,b,{operationId:key}),recordVisit(r,b,{operationId:key})]);expect(results[0]).toEqual(results[1]);expect(results[0]).toMatchObject({rejected:true});expect((await db.collection('visitReceiptAttempts').get()).size).toBe(1);expect((await db.collection('visitReceipts').get()).empty).toBe(true);expect((await db.collection('offlineReceipts').get()).empty).toBe(true);});
it('confirmed original receipt wins on lost-response retry even after the bill becomes stale or handover freezes',async()=>{const{r,b}=await receiptReady(),{randomUUID}=await import('node:crypto'),key=randomUUID(),first:any=await recordVisit(r,b,{operationId:key});await db.collection('carVisits').doc('v').update({activeHandoverId:'frozen'});expect(await recordVisit(r,b,{operationId:key})).toEqual({...first,alreadyRecorded:true});expect((await db.collection('visitReceiptAttempts').get()).empty).toBe(true);expect((await db.collection('visitReceipts').get()).size).toBe(1);});
it.each(['missing-sibling','sibling-time','unlisted-child','parent-currency'])('complete visit receipt evidence is required before any balance review: %s',async kind=>{const{r,b}=await receiptReady(),result:any=await recordVisit(r,b),parent=(await db.collection('visitReceipts').doc(result.receiptId).get()).data()!,sibling=parent.applications.find((a:any)=>a.jobId==='interior');if(kind==='missing-sibling'){await db.collection('offlineReceipts').doc(sibling.applicationId).delete();await db.collection('jobs').doc('interior').update({offlineSettlement:FieldValue.delete(),paymentStatus:'unpaid'});}if(kind==='sibling-time')await db.collection('offlineReceipts').doc(sibling.applicationId).update({createdAt:'2026-11-16T00:00:00.000Z'});if(kind==='unlisted-child')await db.collection('offlineReceipts').doc('unlisted').set({...((await db.collection('offlineReceipts').doc(sibling.applicationId).get()).data()),id:'unlisted',jobId:'outside-visit'});if(kind==='parent-currency')await db.collection('visitReceipts').doc(result.receiptId).update({currency:'USD'});await expect(read()).rejects.toThrow('receipt');await expect(prepare(r.reviewToken)).rejects.toThrow('receipt');await expect(recordVisit(r,b)).rejects.toThrow('receipt');expect((await db.collection('visitReceipts').get()).size).toBe(1);expect((await db.collection('visitReceiptAttempts').get()).empty).toBe(true);expect((await db.collection('visitInvoices').get()).empty).toBe(true);});
const providerUser={uid:'staff',displayName:'Fixture staff',email:null,claims:{role:'admin',tenantId:'t',studioId:'s'}}as any;
async function providerClaimInput(){const{randomUUID}=await import('node:crypto'),{r,b}=await receiptReady();return{r,b,command:{visitId:'v',billId:b.billId,reviewToken:r.reviewToken,operationId:randomUUID(),confirmed:true as const}};}
it('dormant provider claim freezes one prepared bill, exact retry and zero financial/provider effects',async()=>{const{claimVisitProviderAttempt}=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),first=await claimVisitProviderAttempt(db,providerUser,command);expect(first).toMatchObject({alreadyClaimed:false,attempt:{state:'claimed',amountPaise:360000}});expect(await claimVisitProviderAttempt(db,providerUser,command)).toEqual({...first,alreadyClaimed:true});expect((await db.collection('visitProviderHeads').get()).size).toBe(1);expect((await db.collection('visitProviderAttempts').get()).size).toBe(1);for(const c of['payments','visitReceipts','offlineReceipts','invoices','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true)});
it('concurrent dormant provider claims cannot claim the same visit balance twice',async()=>{const{claimVisitProviderAttempt}=await import('../../lib/visit-provider-store.js'),{randomUUID}=await import('node:crypto'),{command}=await providerClaimInput(),results=await Promise.allSettled([claimVisitProviderAttempt(db,providerUser,command),claimVisitProviderAttempt(db,providerUser,{...command,operationId:randomUUID()})]);expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect((await db.collection('visitProviderAttempts').get()).size).toBe(1)});
it('provider head blocks stale offline receipt, preparation, cancellation and duplicate collection without money writes',async()=>{const{claimVisitProviderAttempt}=await import('../../lib/visit-provider-store.js'),{r,b,command}=await providerClaimInput();await claimVisitProviderAttempt(db,providerUser,command);await expect(read()).rejects.toThrow('reconciliation');await expect(prepare(r.reviewToken)).rejects.toThrow('reconciliation');await expect(recordVisit(r,b)).rejects.toThrow('reconciliation');await expect(cancelService('wash',r.reviewToken)).rejects.toThrow('reconciliation');for(const c of['payments','visitReceipts','offlineReceipts','visitReceiptAttempts','visitCancellationReceipts','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true)});
it('durable submitting state emits create exactly once, including concurrent begin, timeout and lost response',async()=>{const{claimVisitProviderAttempt,beginVisitProviderSubmission,markVisitProviderUncertain,bindVisitProviderLink}=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),{attempt}=await claimVisitProviderAttempt(db,providerUser,command),results=await Promise.all([beginVisitProviderSubmission(db,providerUser,'v',attempt.id),beginVisitProviderSubmission(db,providerUser,'v',attempt.id)]);expect(results.filter(Boolean)).toHaveLength(1);expect(await markVisitProviderUncertain(db,providerUser,'v',attempt.id)).toBe('uncertain');expect(await beginVisitProviderSubmission(db,providerUser,'v',attempt.id)).toBeNull();const evidence={referenceId:attempt.id,amountPaise:360000,currency:'INR',providerLinkId:'plink_fixture',providerOrderId:'order_fixture',paymentUrl:'https://payments.example.invalid/fixture'};expect(await bindVisitProviderLink(db,providerUser,'v',attempt.id,evidence)).toMatchObject({state:'link_ready'});expect(await beginVisitProviderSubmission(db,providerUser,'v',attempt.id)).toBeNull();await expect(bindVisitProviderLink(db,providerUser,'v',attempt.id,{...evidence,providerLinkId:'plink_other'})).rejects.toThrow();expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.link.providerLinkId).toBe('plink_fixture')});
it('changed or missing prepared bill and stale review create no provider claim',async()=>{const{claimVisitProviderAttempt}=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput();await expect(claimVisitProviderAttempt(db,providerUser,{...command,billId:'absent'})).rejects.toThrow();await db.collection('carVisits').doc('v').update({revision:2});await expect(claimVisitProviderAttempt(db,providerUser,command)).rejects.toThrow('changed');expect((await db.collection('visitProviderAttempts').get()).empty).toBe(true);expect((await db.collection('visitProviderHeads').get()).empty).toBe(true)});
it('visit changes after claim prevent first submission and preserve the reconciliation hold',async()=>{const{claimVisitProviderAttempt,beginVisitProviderSubmission}=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),{attempt}=await claimVisitProviderAttempt(db,providerUser,command);await db.collection('carVisits').doc('v').update({revision:2});await expect(beginVisitProviderSubmission(db,providerUser,'v',attempt.id)).rejects.toThrow('changed');expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.state).toBe('claimed');await expect(read()).rejects.toThrow('reconciliation')});
it('provider claim and continuation enforce tenant, studio, role and originating staff scope',async()=>{const{claimVisitProviderAttempt,beginVisitProviderSubmission}=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput();for(const claims of[{role:'customer',tenantId:'t',studioId:'s'},{role:'accountant',tenantId:'t',studioId:'s'},{role:'admin',tenantId:'other',studioId:'s'},{role:'studio',tenantId:'t',studioId:'other'}])await expect(claimVisitProviderAttempt(db,{...providerUser,claims},command)).rejects.toBeDefined();expect((await db.collection('visitProviderHeads').get()).empty).toBe(true);const{attempt}=await claimVisitProviderAttempt(db,providerUser,command);await expect(beginVisitProviderSubmission(db,{...providerUser,uid:'other-staff'},'v',attempt.id)).rejects.toThrow();expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.state).toBe('claimed')});

it('same provider operation cannot be reused for another review and malformed head never releases collection',async()=>{const{claimVisitProviderAttempt}=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),{attempt}=await claimVisitProviderAttempt(db,providerUser,command);await expect(claimVisitProviderAttempt(db,providerUser,{...command,reviewToken:'b'.repeat(64)})).rejects.toThrow();await db.collection('visitProviderHeads').doc('v').update({tenantId:'other'});await expect(read()).rejects.toThrow('reconciliation');await expect(claimVisitProviderAttempt(db,providerUser,command)).rejects.toThrow();expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.state).toBe('claimed')});
async function providerCaptureFixture(){const store=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id);const link={referenceId:attempt.id,amountPaise:360000,currency:'INR',providerLinkId:'plink_fixture',providerOrderId:'order_fixture',paymentUrl:'https://payments.example.invalid/fixture'};await store.bindVisitProviderLink(db,providerUser,'v',attempt.id,link);return{attempt,event:{eventType:'payment.captured',eventId:'fixture_event',referenceId:attempt.id,providerPaymentId:'pay_fixture',providerLinkId:link.providerLinkId,providerOrderId:link.providerOrderId,amountPaise:360000,currency:'INR'}};}
it('dormant verified capture evidence records actual money once but never paid jobs, invoices or accounting projections',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{attempt,event}=await providerCaptureFixture();expect(await record(db,event)).toMatchObject({outcome:'captured_review'});expect(await record(db,event)).toMatchObject({outcome:'captured_review',duplicateEvent:true});expect(await record(db,{...event,eventId:'second_event',eventType:'payment_link.paid'})).toMatchObject({outcome:'duplicate'});expect((await db.collection('visitProviderCaptures').get()).size).toBe(1);expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt).toMatchObject({state:'captured_review',capture:{providerPaymentId:event.providerPaymentId}});for(const c of['payments','offlineReceipts','visitReceipts','invoices','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);expect((await db.collection('jobs').get()).docs.every(d=>d.data().paymentStatus==='unpaid')).toBe(true);await expect(read()).rejects.toThrow('reconciliation')});
it('concurrent capture events for one provider payment persist one identity and a single held captured outcome',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{event}=await providerCaptureFixture(),results=await Promise.all([record(db,event),record(db,{...event,eventId:'concurrent_event',eventType:'payment_link.paid'})]);expect(results.map(x=>x.outcome).sort()).toEqual(['captured_review','duplicate']);expect((await db.collection('visitProviderCaptures').get()).size).toBe(1)});
it('extra actual capture stays separate evidence and cannot replace first payment or release the hold',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);expect(await record(db,{...event,eventId:'extra_event',providerPaymentId:'pay_extra'})).toMatchObject({outcome:'extra_capture_review'});expect((await db.collection('visitProviderCaptures').get()).size).toBe(2);expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.capture.providerPaymentId).toBe(event.providerPaymentId);await expect(read()).rejects.toThrow('reconciliation')});
it('capture event identity cannot be reused for different money and mismatches retain evidence without allocating',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{event}=await providerCaptureFixture();expect(await record(db,{...event,amountPaise:1})).toMatchObject({outcome:'held'});await expect(record(db,event)).rejects.toMatchObject({code:'already-exists'});expect((await db.collection('visitProviderCaptures').get()).empty).toBe(true);expect((await db.collection('visitProviderEvents').get()).size).toBe(1)});
it('early verified capture remains retryable after link recovery instead of disappearing as a processed event',async()=>{const store=await import('../../lib/visit-provider-store.js'),{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id);const event={eventType:'payment.captured',eventId:'early_event',referenceId:attempt.id,providerPaymentId:'pay_early',providerLinkId:'plink_early',providerOrderId:null,amountPaise:360000,currency:'INR'};expect(await record(db,event)).toMatchObject({outcome:'held'});expect((await db.collection('visitProviderCaptures').get()).empty).toBe(true);await store.markVisitProviderUncertain(db,providerUser,'v',attempt.id);await store.bindVisitProviderLink(db,providerUser,'v',attempt.id,{...event,paymentUrl:'https://payments.example.invalid/early'});expect(await record(db,event)).toMatchObject({outcome:'captured_review'});expect((await db.collection('visitProviderCaptures').get()).size).toBe(1)});
it('one original provider payment cannot be attached to a second visit attempt',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const second={...attempt,id:'vp_second',visitId:'v_second',review:{...attempt.review,visitId:'v_second'},allocation:{...attempt.allocation,visitId:'v_second'},state:'link_ready',link:{providerLinkId:event.providerLinkId,providerOrderId:event.providerOrderId,paymentUrl:'https://payments.example.invalid/second'},capture:null};await db.collection('visitProviderAttempts').doc(second.id).set({id:second.id,tenantId:'t',studioId:'s',visitId:second.visitId,attempt:second});await db.collection('visitProviderHeads').doc(second.visitId).set({visitId:second.visitId,tenantId:'t',attemptId:second.id});expect(await record(db,{...event,eventId:'conflict_event',referenceId:second.id})).toMatchObject({outcome:'identity_conflict_review'});expect((await db.collection('visitProviderCaptures').get()).size).toBe(1);expect((await db.collection('visitProviderAttempts').doc(second.id).get()).data()!.attempt.capture).toBeNull()});
it('verified capture binding mismatches never reserve a payment identity or mutate the attempt',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{attempt,event}=await providerCaptureFixture();let n=0;for(const patch of[{providerLinkId:'plink_other'},{providerOrderId:null},{providerOrderId:'order_other'},{amountPaise:1},{currency:'USD'},{referenceId:'vp_absent'}])expect(await record(db,{...event,...patch,eventId:'mismatch_'+n++})).toMatchObject({outcome:'held'});expect((await db.collection('visitProviderCaptures').get()).empty).toBe(true);expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.state).toBe('link_ready');await expect(record(db,{...event,eventId:'bad_event',eventType:'payment.failed'})).rejects.toThrow('Invalid');expect((await db.collection('visitProviderEvents').get()).size).toBe(6)});
it('missing capture identity or reconciliation head blocks continuation instead of silently repairing money',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);for(const doc of(await db.collection('visitProviderCaptures').get()).docs)await doc.ref.delete();await expect(record(db,{...event,eventId:'missing_identity_event'})).rejects.toThrow('identity is missing');await db.collection('visitProviderHeads').doc('v').delete();await expect(record(db,{...event,eventId:'missing_head_event',providerPaymentId:'extra'})).rejects.toThrow('hold is missing');expect((await db.collection('visitProviderEvents').get()).size).toBe(1);expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt.state).toBe('captured_review')});
async function seedOnlineReceiptProof(){const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{planVisitOnlineReceipt}=await import('../../lib/visit-online-receipt.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const updated=(await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.attempt,capture=(await db.collection('visitProviderCaptures').get()).docs[0]!.data(),plan=planVisitOnlineReceipt(updated,capture);const invoice={id:plan.receipt.invoiceId,kind:'shared_visit_invoice',status:'issued',receiptId:plan.receipt.id,receiptSource:'visit_online_receipt',sharedVisitId:'v',tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',currency:'INR',sourceToken:updated.reviewToken,invoiceNumber:'INV-FIXTURE',membershipRevision:updated.review.revision,issuedAt:capture.createdAt,totalPaise:360000,subtotalPaise:360000,discountPaise:0,taxPaise:0,roundOffPaise:0,customerSnapshot:{name:'Fixture customer'},vehicleSnapshot:{registrationNumber:'TEST CAR'},components:updated.review.lines.filter((l:any)=>l.amountPaise>l.appliedPaise&&!l.cancelled).map((l:any)=>({jobId:l.jobId,amountPaise:l.amountPaise,subtotalPaise:l.amountPaise,discountPaise:0,taxPaise:0,roundOffPaise:0,taxRatePercent:0,taxDescription:'No tax',lineItems:[{description:l.jobId,quantity:1,unitPrice:l.amountPaise,total:l.amountPaise}]}))};await db.collection('visitOnlineReceipts').doc(plan.receipt.id).set({...plan.receipt,privateReference:'PRIVATE'});for(const a of plan.applications)await db.collection('visitOnlineApplications').doc(a.id).set(a);await db.collection('visitInvoices').doc(invoice.id).set(invoice);return{...plan,invoice,capture,updated};}
it('dormant online journal reads one complete finite money row and never counts application rows as cash',async()=>{const{readVisitOnlineLedger,visitOnlineLedgerTotals}=await import('../../lib/visit-online-ledger.js'),f=await seedOnlineReceiptProof(),rows=await readVisitOnlineLedger(db,'t','s');expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({method:'razorpay_payment_link',receivedPaise:360000,invoiceId:f.invoice.id,recognisedAt:f.capture.createdAt});expect(JSON.stringify(rows)).not.toContain('PRIVATE');expect(JSON.stringify(rows)).not.toContain('pay_fixture');const{utcToLocalDate}=await import('../../lib/schedule.js'),day=utcToLocalDate(new Date(f.capture.createdAt),'Asia/Kolkata');expect(visitOnlineLedgerTotals(rows,day)).toMatchObject({receivedPaise:360000,paymentCount:1});expect(await readVisitOnlineLedger(db,'t','other')).toEqual([]);expect((await db.collection('offlineReceipts').get()).empty).toBe(true);expect((await db.collection('payments').get()).empty).toBe(true)});
it.each(['missing-app','outside-studio-app','orphan-app','wrong-event','missing-capture','wrong-invoice','wrong-receipt'])('online money reader holds whole totals when complete original evidence fails: %s',async kind=>{const{readVisitOnlineLedger}=await import('../../lib/visit-online-ledger.js'),f=await seedOnlineReceiptProof();if(kind==='missing-app')await db.collection('visitOnlineApplications').doc(f.applications[0]!.id).delete();if(kind==='outside-studio-app')await db.collection('visitOnlineApplications').doc(f.applications[0]!.id).update({studioId:'other'});if(kind==='orphan-app')await db.collection('visitOnlineApplications').doc('orphan').set({...f.applications[0],id:'orphan',receiptId:'missing'});if(kind==='wrong-event')for(const d of(await db.collection('visitProviderEvents').get()).docs)await d.ref.update({outcome:'duplicate'});if(kind==='missing-capture')for(const d of(await db.collection('visitProviderCaptures').get()).docs)await d.ref.delete();if(kind==='wrong-invoice')await db.collection('visitInvoices').doc(f.invoice.id).update({receiptSource:'cash'});if(kind==='wrong-receipt')await db.collection('visitOnlineReceipts').doc(f.receipt.id).update({receivedPaise:1});await expect(readVisitOnlineLedger(db,'t','s')).rejects.toThrow('No partial');});
it('dormant atomic online settlement issues one original invoice, pays exact jobs and preserves original provider evidence',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const prior=(await db.collection('visitProviderAttempts').doc(attempt.id).get()).data();const result=await settle(db,attempt.id);expect(result.alreadySettled).toBe(false);expect(await settle(db,attempt.id)).toEqual({...result,alreadySettled:true});expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()).toEqual(prior);expect(await read()).toMatchObject({balancePaise:0,appliedPaise:360000,lines:[{invoiceId:result.invoiceId},{invoiceId:result.invoiceId}]});for(const c of['payments','offlineReceipts','visitReceipts','invoices'])expect((await db.collection(c).get()).empty,c).toBe(true);expect((await db.collection('visitOnlineReceipts').get()).size).toBe(1);expect((await db.collection('visitOnlineApplications').get()).size).toBe(2);const{readVisitOnlineLedger}=await import('../../lib/visit-online-ledger.js');expect(await readVisitOnlineLedger(db,'t','s')).toHaveLength(1);const{getVisitInvoice}=await import('../../functions/visit/getVisitInvoice.js');expect(await getVisitInvoice.run(request({invoiceId:result.invoiceId},'customer','customer'))).toMatchObject({totalPaise:360000});});
it('concurrent dormant settlement retries commit one receipt and one invoice',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const results=await Promise.all([settle(db,attempt.id),settle(db,attempt.id)]);expect(results.filter(r=>!r.alreadySettled)).toHaveLength(1);expect((await db.collection('visitOnlineReceipts').get()).size).toBe(1);expect((await db.collection('visitInvoices').get()).size).toBe(1)});
it('captured money on a changed bill remains review held with no partial paid projection',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);await db.collection('carVisits').doc('v').update({revision:2});await expect(settle(db,attempt.id)).rejects.toThrow('reconciliation');for(const c of['visitOnlineReceipts','visitOnlineApplications','visitInvoices','invoiceCounters'])expect((await db.collection(c).get()).empty,c).toBe(true);expect((await db.collection('jobs').get()).docs.every(d=>d.data().paymentStatus==='unpaid')).toBe(true)});
it('extra capture after settlement reholds the visit and never overwrites its issued original',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const result=await settle(db,attempt.id),original=(await db.collection('visitInvoices').doc(result.invoiceId).get()).data();await record(db,{...event,eventId:'late_extra',providerPaymentId:'pay_late_extra'});await expect(read()).rejects.toThrow('reconciliation');await expect(settle(db,attempt.id)).rejects.toThrow('reconciliation');expect((await db.collection('visitInvoices').doc(result.invoiceId).get()).data()).toEqual(original);expect((await db.collection('visitOnlineReceipts').get()).size).toBe(1)});

it('dormant online capture settles through original invoice and real guarded handover without fake legacy payments',async()=>{const{recordJobPerformedWork}=await import('../../functions/work/recordJobPerformedWork.js'),{startVisitHandover}=await import('../../functions/visit/startVisitHandover.js'),{completeVisitHandover}=await import('../../functions/visit/completeVisitHandover.js'),{visitWorkReview}=await import('../../lib/visit-work-review.js'),{randomUUID}=await import('node:crypto');for(const id of['wash','interior']){await db.collection('jobs').doc(id).update({status:'READY_FOR_DELIVERY',statusHistory:[],bayId:'',createdAt:new Date().toISOString(),scheduledAt:new Date().toISOString(),estimatedEndAt:new Date().toISOString(),estimatedEndDate:'2026-11-15',estimatedDurationMinutes:60,isWalkIn:false,assignedEmployeeId:null,sealedAt:null});await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:0,action:'record',lineId:'booked-0',approvalId:null,performed:true,work:{kind:'service'}}));await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:1,action:'qc',lineId:'booked-0',checked:true}));await recordJobPerformedWork.run(request({jobId:id,operationId:randomUUID(),expectedRevision:2,action:'seal',confirmed:true}));}const r:any=await read(),b:any=await prepare(r.reviewToken);await settleCurrentOnline(r,b);const members=await Promise.all(['wash','interior'].map(async jobId=>({jobId,expectedUpdatedAt:(await db.collection('jobs').doc(jobId).get()).data()!.updatedAt,recordedWork:visitWorkReview((await db.collection('jobPerformedWork').doc(jobId).get()).data())})));const manifest:any=await startVisitHandover.run(request({visitId:'v',expectedRevision:1,operationId:randomUUID(),confirmed:true,members}));expect(await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}))).toMatchObject({status:'complete',error:null});for(const id of['wash','interior'])expect((await db.collection('jobs').doc(id).get()).data()!.status).toBe('DELIVERED');expect((await db.collection('invoices').get()).empty).toBe(true);expect((await db.collection('visitInvoices').get()).size).toBe(1);expect(await read()).toMatchObject({balancePaise:0});});
async function settleCurrentOnline(r:any,b:any){const store=await import('../../lib/visit-provider-store.js'),{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{randomUUID}=await import('node:crypto'),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,{visitId:'v',billId:b.billId,reviewToken:r.reviewToken,operationId:randomUUID(),confirmed:true});await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id);const link={referenceId:attempt.id,amountPaise:r.balancePaise,currency:'INR',providerLinkId:'plink_current',providerOrderId:'order_current',paymentUrl:'https://payments.example.invalid/current'};await store.bindVisitProviderLink(db,providerUser,'v',attempt.id,link);await record(db,{...link,eventType:'payment.captured',eventId:'current_capture',providerPaymentId:'pay_current'});return settle(db,attempt.id);}
it('cash partial plus online final agrees across bill, Daily Close, Office and Accountant with two money events',async()=>{const{dayAggregates}=await import('../../lib/dayAggregates.js'),{getOfficeReport}=await import('../../functions/office/getOfficeReport.js'),{getAccountantMoney}=await import('../../functions/office/getAccountantMoney.js');for(const id of['wash','interior'])await db.collection('jobs').doc(id).update({createdAt:new Date().toISOString(),statusHistory:[]});const{r,b}=await receiptReady();await recordVisit(r,b);const next:any=await read(),nextBill:any=await prepare(next.reviewToken),result=await settleCurrentOnline(next,nextBill),day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),month=day.slice(0,7);expect(await read()).toMatchObject({balancePaise:0,appliedPaise:360000});expect(await dayAggregates('t','s',day)).toMatchObject({cashPaise:72000,razorpayPaise:288000,totalRevenuePaise:360000,paymentCount:2});expect(await getOfficeReport.run(request({studioId:'s',month}))).toMatchObject({cashPaise:72000,razorpayPaise:288000,totalRevenuePaise:360000,paymentCount:2});const accountant:any=await getAccountantMoney.run(request({studioId:'s',month},'accountant'));expect(accountant.report).toMatchObject({totalReceiptsPaise:360000,cashPaise:72000,razorpayPaise:288000,paymentCount:2});expect(accountant.onlineReceipts).toHaveLength(1);expect(accountant.invoices).toMatchObject([{id:result.invoiceId,total:360000}]);expect(JSON.stringify(accountant)).not.toContain('pay_current');expect(JSON.stringify(accountant)).not.toContain('plink_current');expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('invoices').get()).empty).toBe(true)});
it.each(['issuer','counter','extra-capture','unresolved-event'])('online settlement is atomic and remains held on %s',async kind=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);if(kind==='issuer')await db.collection('studioConfig').doc('s').update({invoiceIssuer:null});if(kind==='counter')await db.collection('invoiceCounters').doc('t').set({tenantId:'other',nextNumber:1,year:2026});if(kind==='extra-capture')await record(db,{...event,eventId:'second_capture',providerPaymentId:'pay_second'});if(kind==='unresolved-event')await record(db,{...event,eventId:'mismatch_capture',amountPaise:1});await expect(settle(db,attempt.id)).rejects.toThrow();for(const c of['visitOnlineReceipts','visitOnlineApplications','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);expect((await db.collection('jobs').get()).docs.every(d=>d.data().paymentStatus==='unpaid')).toBe(true);await expect(read()).rejects.toThrow('reconciliation')});
it.each(['missing-app','changed-app','missing-receipt','missing-invoice'])('settled online evidence corruption cannot reopen money or pass a bill: %s',async kind=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const result=await settle(db,attempt.id);const apps=await db.collection('visitOnlineApplications').get();if(kind==='missing-app')await apps.docs[0]!.ref.delete();if(kind==='changed-app')await apps.docs[0]!.ref.update({appliedPaise:1});if(kind==='missing-receipt')await db.collection('visitOnlineReceipts').doc(result.receiptId).delete();if(kind==='missing-invoice')await db.collection('visitInvoices').doc(result.invoiceId).delete();await expect(read()).rejects.toThrow();await expect(settle(db,attempt.id)).rejects.toThrow();expect((await db.collection('payments').get()).empty).toBe(true);expect((await db.collection('offlineReceipts').get()).empty).toBe(true)});
it('unsettled or extra captured money never silently disappears from Office, Daily Close or Accountant totals',async()=>{const{recordVerifiedVisitCaptureEvidence:record}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment:settle}=await import('../../lib/visit-provider-settlement.js'),{dayAggregates}=await import('../../lib/dayAggregates.js'),{getAccountantMoney}=await import('../../functions/office/getAccountantMoney.js'),{readVisitOnlineLedger}=await import('../../lib/visit-online-ledger.js'),{attempt,event}=await providerCaptureFixture();await record(db,event);const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});await expect(readVisitOnlineLedger(db,'t','s')).rejects.toThrow('No partial');await expect(dayAggregates('t','s',day)).rejects.toThrow('No partial');await expect(getAccountantMoney.run(request({studioId:'s',month:day.slice(0,7)},'accountant'))).rejects.toThrow('No partial');await settle(db,attempt.id);await record(db,{...event,eventId:'extra_after_issued',providerPaymentId:'pay_extra_after_issued'});await expect(readVisitOnlineLedger(db,'t','s')).rejects.toThrow('No partial');await expect(dayAggregates('t','s',day)).rejects.toThrow('No partial')});
it('online final settlement preserves an older paid invoice and does not issue that obligation twice',async()=>{await paid();await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});const p=(await db.collection('payments').doc('p').get()).data(),old=(await db.collection('invoices').doc('i').get()).data(),r:any=await read(),b:any=await prepare(r.reviewToken),result=await settleCurrentOnline(r,b);expect((await db.collection('payments').doc('p').get()).data()).toEqual(p);expect((await db.collection('invoices').doc('i').get()).data()).toEqual(old);expect((await db.collection('visitInvoices').doc(result.invoiceId).get()).data()).toMatchObject({totalPaise:240000,jobIds:['interior']});expect(await read()).toMatchObject({balancePaise:0,lines:[{invoiceId:'i'},{invoiceId:result.invoiceId}]});expect((await db.collection('visitOnlineApplications').get()).size).toBe(1)});
it('provider claim racing an offline receipt cannot reserve and collect the same reviewed balance',async()=>{const{claimVisitProviderAttempt}=await import('../../lib/visit-provider-store.js'),{r,b,command}=await providerClaimInput(),results=await Promise.allSettled([claimVisitProviderAttempt(db,providerUser,command),recordVisit(r,b)]);const wins=results.filter(x=>x.status==='fulfilled'&&!(x.value as any).rejected);expect(wins).toHaveLength(1);const claims=(await db.collection('visitProviderAttempts').get()).size,receipts=(await db.collection('visitReceipts').get()).size;expect(claims+receipts).toBe(1);expect((await db.collection('payments').get()).empty).toBe(true)});
it('dormant provider candidate survives failed verification without binding, payment or permission to create again',async()=>{
 const store=await import('../../lib/visit-provider-store.js'),{verifyVisitProviderFetchedLink}=await import('../../lib/visit-provider-recovery.js');
 const{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);
 const candidate={providerPaymentLinkId:'plink_candidate',providerOrderId:null,paymentUrl:'https://payments.example.invalid/candidate'};
 expect(await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id)).not.toBeNull();
 await store.saveVisitProviderCandidate(db,providerUser,'v',attempt.id,candidate);
 await store.markVisitProviderUncertain(db,providerUser,'v',attempt.id);
 const recovered=await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id);
 expect(recovered).toMatchObject({candidate,attempt:{state:'uncertain',link:null}});
 expect(()=>verifyVisitProviderFetchedLink(recovered.attempt,candidate,null)).toThrow();
 expect(await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id)).toBeNull();
 await expect(store.saveVisitProviderCandidate(db,providerUser,'v',attempt.id,{...candidate,providerPaymentLinkId:'plink_other'})).rejects.toThrow('Original');
 await expect(store.bindVisitProviderLink(db,providerUser,'v',attempt.id,{referenceId:attempt.id,amountPaise:360000,currency:'INR',providerLinkId:'plink_other',providerOrderId:'order_candidate',paymentUrl:candidate.paymentUrl})).rejects.toThrow('candidate');
 const fetched={...candidate,providerOrderId:'order_candidate',amount:360000,currency:'INR',status:'created',evidence:{referenceId:attempt.id,amountPaid:0,payments:[]}};
 const evidence=verifyVisitProviderFetchedLink(recovered.attempt,candidate,fetched);
 expect(await store.bindVisitProviderLink(db,providerUser,'v',attempt.id,evidence)).toMatchObject({state:'link_ready',link:{providerLinkId:candidate.providerPaymentLinkId,providerOrderId:'order_candidate'}});
 expect(await store.saveVisitProviderCandidate(db,providerUser,'v',attempt.id,candidate)).toEqual(candidate);
 expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).candidate).toEqual(candidate);
 for(const collection of['payments','visitReceipts','visitOnlineReceipts','visitProviderCaptures','visitInvoices'])expect((await db.collection(collection).get()).empty,collection).toBe(true);
});
it('dormant candidate recovery is origin-staff scoped and cannot start before durable submission',async()=>{
 const store=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);
 const candidate={providerPaymentLinkId:'plink_candidate',providerOrderId:null,paymentUrl:'https://payments.example.invalid/candidate'};
 await expect(store.saveVisitProviderCandidate(db,providerUser,'v',attempt.id,candidate)).rejects.toThrow();
 await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id);
 await expect(store.saveVisitProviderCandidate(db,{...providerUser,uid:'other'},'v',attempt.id,candidate)).rejects.toThrow();
 await expect(store.readVisitProviderRecovery(db,{...providerUser,uid:'other'},'v',attempt.id)).rejects.toThrow();
 expect((await db.collection('visitProviderAttempts').doc(attempt.id).get()).data()!.candidate).toBeUndefined();
});
it('dormant concurrent candidate responses cannot overwrite the first recovery identity',async()=>{
 const store=await import('../../lib/visit-provider-store.js'),{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);
 await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id);
 const candidate={providerPaymentLinkId:'plink_candidate',providerOrderId:null,paymentUrl:'https://payments.example.invalid/candidate'};
 const results=await Promise.allSettled([store.saveVisitProviderCandidate(db,providerUser,'v',attempt.id,candidate),store.saveVisitProviderCandidate(db,providerUser,'v',attempt.id,{...candidate,providerPaymentLinkId:'plink_other'})]);
 expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
 expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).attempt).toMatchObject({state:'submitting',link:null});
 expect(await store.beginVisitProviderSubmission(db,providerUser,'v',attempt.id)).toBeNull();
});
async function qualifiedProviderFixture(){
 const{vi}=await import('vitest'),store=await import('../../lib/visit-provider-store.js'),{qualifyVisitProviderSubmission}=await import('../../lib/visit-provider-runner.js');
 const{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);
 const candidate={providerPaymentLinkId:'plink_candidate',providerOrderId:'order_candidate',paymentUrl:'https://payments.example.invalid/candidate'};
 const port={createVisitPaymentLink:vi.fn(async()=>candidate),fetchPaymentLink:vi.fn(async(_id:string)=>({...candidate,amount:360000,currency:'INR',status:'created',evidence:{referenceId:attempt.id,amountPaid:0,payments:[]}})as any)};
 const run=()=>qualifyVisitProviderSubmission(db,providerUser,'v',attempt.id,port);
 return{store,attempt,candidate,port,run};
}
it('dormant qualified runner persists submit before exactly one whole-visit create and fetches explicit binding proof',async()=>{
 const{port,run,attempt,store,candidate}=await qualifiedProviderFixture();
 port.createVisitPaymentLink.mockImplementationOnce(async()=>{expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).attempt.state).toBe('submitting');return candidate;});
 expect(await run()).toEqual({outcome:'link_bound'});expect(await run()).toEqual({outcome:'link_bound'});
 expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);expect(port.createVisitPaymentLink).toHaveBeenCalledWith({visitId:'v',billId:attempt.billId,referenceId:attempt.id,amountPaise:360000,currency:'INR'});
 expect(port.fetchPaymentLink).toHaveBeenCalledTimes(1);
 for(const collection of['payments','visitOnlineReceipts','visitProviderCaptures','visitInvoices'])expect((await db.collection(collection).get()).empty,collection).toBe(true);
});
it('dormant qualified runner never recreates after lost create response or a crash before candidate persistence',async()=>{
 const{port,run,store,attempt}=await qualifiedProviderFixture();port.createVisitPaymentLink.mockRejectedValueOnce(new Error('Synthetic lost response'));
 expect(await run()).toEqual({outcome:'review_required'});expect(await run()).toEqual({outcome:'review_required'});
 expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);expect(port.fetchPaymentLink).not.toHaveBeenCalled();expect(await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).toMatchObject({candidate:null,attempt:{state:'uncertain',link:null}});
});
it('dormant qualified runner recovers a stored create candidate after a missing fetch without issuing another create',async()=>{
 const{port,run,store,attempt,candidate}=await qualifiedProviderFixture();port.fetchPaymentLink.mockResolvedValueOnce(null);
 expect(await run()).toEqual({outcome:'review_required'});expect(await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).toMatchObject({candidate,attempt:{state:'uncertain',link:null}});
 expect(await run()).toEqual({outcome:'link_bound'});expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);expect(port.fetchPaymentLink).toHaveBeenCalledTimes(2);
});
it('dormant qualified concurrent runners cannot submit the same external create twice',async()=>{
 const{port,run}=await qualifiedProviderFixture();await Promise.all([run(),run()]);expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);expect(await run()).toEqual({outcome:'link_bound'});
});
it.each(['reference','amount','currency'])('dormant qualified runner holds conflicting fetched %s without a second create',async kind=>{
 const{port,run,store,attempt}=await qualifiedProviderFixture(),fetched=await port.fetchPaymentLink('unused');
 if(kind==='reference')fetched.evidence.referenceId='vp_other';if(kind==='amount')fetched.amount=1;if(kind==='currency')fetched.currency='';
 port.fetchPaymentLink.mockResolvedValue(fetched);expect(await run()).toEqual({outcome:'review_required'});expect(await run()).toEqual({outcome:'review_required'});expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).attempt).toMatchObject({state:'uncertain',link:null});
});
it('dormant strict raw signature boundary joins original verified capture and atomic settlement without legacy payment projection',async()=>{
 const{createHmac}=await import('node:crypto'),{RazorpayProvider}=await import('../../lib/razorpay-provider.js'),{inspectVisitProviderWebhook}=await import('../../lib/visit-provider-webhook.js'),{recordVerifiedVisitCaptureEvidence}=await import('../../lib/visit-provider-capture.js'),{settleCapturedVisitPayment}=await import('../../lib/visit-provider-settlement.js');
 const{attempt,event}=await providerCaptureFixture(),key='synthetic-local-webhook';
 const payload={event:'payment_link.paid',payload:{payment_link:{entity:{id:event.providerLinkId,reference_id:attempt.id,order_id:event.providerOrderId,amount:360000,amount_paid:360000,currency:'INR',status:'paid',accept_partial:false}},payment:{entity:{id:event.providerPaymentId,order_id:event.providerOrderId,amount:360000,currency:'INR',status:'captured',captured:true,amount_refunded:0}}}};
 const raw=JSON.stringify(payload),signature=createHmac('sha256',key).update(raw).digest('hex'),provider=new RazorpayProvider('synthetic-key','synthetic-secret',key);
 expect(()=>inspectVisitProviderWebhook(raw,'invalid','raw_fixture',i=>provider.verifyWebhookSignature(i))).toThrow('signature');
 expect((await db.collection('visitProviderEvents').get()).empty).toBe(true);
 const inspected=inspectVisitProviderWebhook(raw,signature,'raw_fixture',i=>provider.verifyWebhookSignature(i));
 expect(inspected.outcome).toBe('capture');if(inspected.outcome!=='capture')throw new Error('Expected complete synthetic capture');
 expect(await recordVerifiedVisitCaptureEvidence(db,inspected.evidence)).toMatchObject({outcome:'captured_review'});
 const settled=await settleCapturedVisitPayment(db,attempt.id);
 expect(settled).toMatchObject({alreadySettled:false,receiptId:expect.any(String)});
 expect((await db.collection('visitOnlineReceipts').get()).size).toBe(1);expect((await db.collection('visitInvoices').get()).size).toBe(1);expect((await db.collection('payments').get()).empty).toBe(true);
 expect(await read()).toMatchObject({balancePaise:0});
});
it('dormant owner-scoped discovery recovers a lost-create link only from exact returned and directly fetched evidence',async()=>{
 const{vi}=await import('vitest'),{qualifyVisitProviderDiscovery}=await import('../../lib/visit-provider-runner.js'),{attempt,port,store,run}=await qualifiedProviderFixture();
 port.createVisitPaymentLink.mockRejectedValueOnce(new Error('Synthetic lost create response'));await run();
 const fetched=await port.fetchPaymentLink('unused'),findVisitPaymentLinks=vi.fn(async()=>({complete:true,links:[fetched]}));
 expect(await qualifyVisitProviderDiscovery(db,providerUser,'v',attempt.id,{...port,findVisitPaymentLinks})).toEqual({outcome:'link_bound'});
 expect(findVisitPaymentLinks).toHaveBeenCalledWith(attempt.id);expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);
 expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).attempt).toMatchObject({state:'link_ready'});
 for(const c of['payments','visitOnlineReceipts','visitProviderCaptures','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);
});
it.each(['empty','partial','multiple','wrong-reference','wrong-amount','lookup-error'])('dormant discovery %s never releases or recreates a missing create response',async kind=>{
 const{vi}=await import('vitest'),{qualifyVisitProviderDiscovery}=await import('../../lib/visit-provider-runner.js'),{attempt,port,store,run}=await qualifiedProviderFixture();
 port.createVisitPaymentLink.mockRejectedValueOnce(new Error('Synthetic lost create response'));await run();
 const fetched=await port.fetchPaymentLink('unused');if(kind==='wrong-reference')fetched.evidence.referenceId='vp_other';if(kind==='wrong-amount')fetched.amount=1;
 const findVisitPaymentLinks=vi.fn(async()=>{if(kind==='lookup-error')throw new Error('Synthetic timeout');return{complete:kind!=='partial',links:kind==='empty'?[]:kind==='multiple'?[fetched,{...fetched,providerPaymentLinkId:'plink_other'}]:[fetched]};});
 expect(await qualifyVisitProviderDiscovery(db,providerUser,'v',attempt.id,{...port,findVisitPaymentLinks})).toEqual({outcome:'review_required'});
 expect(await run()).toEqual({outcome:'review_required'});expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);
 expect(await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).toMatchObject({candidate:null,attempt:{state:'uncertain',link:null}});
});
it('dormant discovery preserves its candidate when direct fetch fails and the runner can recover without a create',async()=>{
 const{vi}=await import('vitest'),{qualifyVisitProviderDiscovery}=await import('../../lib/visit-provider-runner.js'),{attempt,port,store,run}=await qualifiedProviderFixture();
 port.createVisitPaymentLink.mockRejectedValueOnce(new Error('Synthetic lost create response'));await run();const fetched=await port.fetchPaymentLink('unused');port.fetchPaymentLink.mockResolvedValueOnce(null);
 expect(await qualifyVisitProviderDiscovery(db,providerUser,'v',attempt.id,{...port,findVisitPaymentLinks:vi.fn(async()=>({complete:true,links:[fetched]}))})).toEqual({outcome:'review_required'});
 expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).candidate).not.toBeNull();expect(await run()).toEqual({outcome:'link_bound'});expect(port.createVisitPaymentLink).toHaveBeenCalledTimes(1);
});
it('dormant discovery refuses another staff member before any external lookup',async()=>{
 const{vi}=await import('vitest'),{qualifyVisitProviderDiscovery}=await import('../../lib/visit-provider-runner.js'),{attempt,port,run}=await qualifiedProviderFixture();port.createVisitPaymentLink.mockRejectedValueOnce(new Error('Synthetic lost response'));await run();
 const findVisitPaymentLinks=vi.fn(async()=>({complete:true,links:[]}));await expect(qualifyVisitProviderDiscovery(db,{...providerUser,uid:'other'},'v',attempt.id,{...port,findVisitPaymentLinks})).rejects.toThrow();expect(findVisitPaymentLinks).not.toHaveBeenCalled();
});
async function signedIngressFixture(){
 const{createHmac}=await import('node:crypto'),{RazorpayProvider}=await import('../../lib/razorpay-provider.js'),{dispatchVisitProviderWebhook}=await import('../../lib/visit-provider-dispatch.js'),{attempt,event}=await providerCaptureFixture(),key='synthetic-ingress';
 const provider=new RazorpayProvider('synthetic-key','synthetic-secret',key);
 const payload={event:'payment_link.paid',payload:{payment_link:{entity:{id:event.providerLinkId,reference_id:attempt.id,order_id:event.providerOrderId,amount:360000,amount_paid:360000,currency:'INR',status:'paid',accept_partial:false}},payment:{entity:{id:event.providerPaymentId,order_id:event.providerOrderId,amount:360000,currency:'INR',status:'captured',captured:true,amount_refunded:0}}}};
 const dispatch=(value:any,id='ingress_fixture',bad=false)=>{const raw=JSON.stringify(value),signature=bad?'invalid':createHmac('sha256',key).update(raw).digest('hex');return dispatchVisitProviderWebhook(db,raw,signature,id,i=>provider.verifyWebhookSignature(i));};
 return{payload,dispatch,attempt};
}
it('dormant ingress review holds incomplete signed money durably with no raw/customer payload and no settlement',async()=>{
 const{payload,dispatch,attempt}=await signedIngressFixture();delete(payload.payload.payment.entity as any).currency;
 expect(await dispatch(payload)).toEqual({outcome:'review_required',duplicateEvent:false});expect(await dispatch(payload)).toEqual({outcome:'review_required',duplicateEvent:true});
 const reviews=await db.collection('visitProviderIngressReviews').get();expect(reviews.size).toBe(1);expect(reviews.docs[0]!.data()).toMatchObject({tenantId:'t',visitId:'v',referenceId:attempt.id,reason:'incomplete_capture_evidence'});expect(reviews.docs[0]!.data()).not.toHaveProperty('rawBody');
 expect((await db.collection('visitProviderHeads').doc('v').get()).data()!.status).toBe('review_required');
 expect((await db.collection('visitProviderCaptures').get()).empty).toBe(true);await expect(read()).rejects.toThrow('reconciliation');
 const{settleCapturedVisitPayment}=await import('../../lib/visit-provider-settlement.js');await expect(settleCapturedVisitPayment(db,attempt.id)).rejects.toThrow();
});
it('dormant ingress rejects signature before any review write and routes a complete capture to the original journal only',async()=>{
 const{payload,dispatch}=await signedIngressFixture();await expect(dispatch(payload,'invalid',true)).rejects.toThrow('signature');expect((await db.collection('visitProviderIngressReviews').get()).empty).toBe(true);
 expect(await dispatch(payload)).toMatchObject({outcome:'captured_review'});expect((await db.collection('visitProviderEvents').get()).size).toBe(1);expect((await db.collection('visitOnlineReceipts').get()).empty).toBe(true);
});
it('dormant ingress unscoped signed evidence stays private and cannot acquire a fabricated tenant',async()=>{
 const{payload,dispatch}=await signedIngressFixture();const value={event:'payment.captured',payload:{payment:{entity:{...payload.payload.payment.entity,email:'private-fixture@example.invalid'}}}};
 expect(await dispatch(value)).toMatchObject({outcome:'review_required'});const original=(await db.collection('visitProviderIngressReviews').get()).docs[0]!.data();expect(original).toMatchObject({tenantId:null,studioId:null,visitId:null,referenceId:null});expect(JSON.stringify(original)).not.toContain('private-fixture');
});
it('dormant ingress event IDs cannot switch between incomplete review and complete capture',async()=>{
 const{payload,dispatch}=await signedIngressFixture(),incomplete=structuredClone(payload);delete(incomplete.payload.payment.entity as any).currency;await dispatch(incomplete);
 await expect(dispatch(payload)).rejects.toThrow('identity');expect((await db.collection('visitProviderCaptures').get()).empty).toBe(true);
});
it('dormant ingress captured event IDs cannot be reused for incomplete evidence',async()=>{
 const{payload,dispatch}=await signedIngressFixture();await dispatch(payload);delete(payload.payload.payment.entity as any).currency;await expect(dispatch(payload)).rejects.toThrow('identity');expect((await db.collection('visitProviderIngressReviews').get()).empty).toBe(true);
});
it('dormant incomplete ingress after settled money reholds reports without rewriting the original receipt or invoice',async()=>{
 const{payload,dispatch,attempt}=await signedIngressFixture(),{settleCapturedVisitPayment}=await import('../../lib/visit-provider-settlement.js'),{readVisitOnlineLedger}=await import('../../lib/visit-online-ledger.js');
 await dispatch(payload);const result=await settleCapturedVisitPayment(db,attempt.id),original=(await db.collection('visitInvoices').doc(result.invoiceId).get()).data(),receipt=(await db.collection('visitOnlineReceipts').doc(result.receiptId).get()).data();
 expect(await readVisitOnlineLedger(db,'t','s')).toHaveLength(1);delete(payload.payload.payment.entity as any).currency;
 expect(await dispatch(payload,'late_incomplete')).toMatchObject({outcome:'review_required'});await expect(readVisitOnlineLedger(db,'t','s')).rejects.toThrow('history needs review');await expect(read()).rejects.toThrow();await expect(settleCapturedVisitPayment(db,attempt.id)).rejects.toThrow();
 expect((await db.collection('visitInvoices').doc(result.invoiceId).get()).data()).toEqual(original);expect((await db.collection('visitOnlineReceipts').doc(result.receiptId).get()).data()).toEqual(receipt);
});
it('dormant incomplete ingress and capture racing on one identity cannot produce two event meanings',async()=>{
 const{payload,dispatch}=await signedIngressFixture(),incomplete=structuredClone(payload);delete(incomplete.payload.payment.entity as any).currency;
 const results=await Promise.allSettled([dispatch(payload),dispatch(incomplete)]);expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
 expect((await db.collection('visitProviderIngressReviews').get()).size+(await db.collection('visitProviderEvents').get()).size).toBe(1);
});
it('dormant funded cancellation review returns only the cancelled service share and charges no fee while another service proceeds',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED'});
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js'),review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now()));
 expect(review).toMatchObject({jobId:'wash',paidPaise:24000,feePaise:0,returnPaise:24000,feeDuePaise:0,continuingJobIds:['interior'],entries:[{method:'cash',capturedPaise:24000,returnPaise:24000,providerPaymentId:null,originalReceiptId:expect.any(String)}]});
 expect(await read()).toMatchObject({balancePaise:288000});expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('VEHICLE_RECEIVED');for(const c of['refundRequests','visitServiceReturns','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);
});
it('dormant final-service funded cancellation applies existing policy retention only to its original money',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED'});
 // The sibling is still a real funded service, so it must not be silently
 // removed to construct a final-service fee. This is an invalid source state.
 await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js');await expect(db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now()))).rejects.toThrow('original-method review');
});
it('dormant final-service return review caps retained money at actual funding and keeps any existing-policy fee due separate',async()=>{
 await receiptReady();await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});
 const r:any=await read(),b:any=await prepare(r.reviewToken);await recordVisit(r,b,{receivedPaise:5000});await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED'});
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js'),review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now()));
 expect(review).toMatchObject({paidPaise:5000,feePaise:10000,retainedPaise:5000,feeDuePaise:5000,returnPaise:0,continuingJobIds:[]});
});
it('dormant fully funded return review preserves cash and online original identities and never allocates the sibling share',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const next:any=await read(),bill:any=await prepare(next.reviewToken),settled=await settleCurrentOnline(next,bill),original=(await db.collection('visitInvoices').doc(settled.invoiceId).get()).data();await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED'});
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js'),review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now()));
 expect(review).toMatchObject({paidPaise:120000,feePaise:0,returnPaise:120000,invoiceId:settled.invoiceId});expect(review.entries).toEqual(expect.arrayContaining([expect.objectContaining({method:'cash',capturedPaise:24000,returnPaise:24000}),expect.objectContaining({method:'razorpay_payment_link',capturedPaise:96000,returnPaise:96000,providerPaymentId:'pay_current',paymentId:null})]));
 expect((await db.collection('visitInvoices').doc(settled.invoiceId).get()).data()).toEqual(original);expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant return review refuses retained-transport and benefit shortcuts before money effects',async()=>{
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js');await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED'});await db.collection('carVisits').doc('v').update({transportJobId:'wash'});await expect(db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now()))).rejects.toThrow();expect((await db.collection('refundRequests').get()).empty).toBe(true);
});

async function savedReturnFixture() {
 const {r,b}=await receiptReady();await recordVisit(r,b);
 const {readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js');
 const review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now()));
 const {randomUUID}=await import('node:crypto');
 const user={uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}}as any;
 const command={visitId:'v',jobId:'wash',operationId:randomUUID(),reviewToken:review.reviewToken,reason:'Customer changed selected work',reviewed:true};
 return{user,command,review};
}
it('dormant service-return journal persists one exact original-method review without cancellation or financial effects',async()=>{
 const{user,command,review}=await savedReturnFixture(),{prepareVisitServiceReturnPlan,readCurrentVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 const job=(await db.collection('jobs').doc('wash').get()).data(),sibling=(await db.collection('jobs').doc('interior').get()).data(),visit=(await db.collection('carVisits').doc('v').get()).data(),receipt=(await db.collection('visitReceipts').get()).docs[0]!.data();
 const first=await prepareVisitServiceReturnPlan(db,user,command);
 expect(first).toMatchObject({alreadyPrepared:false,plan:{kind:'visit_service_return_review',status:'review_only',preparedBy:'staff',review}});
 expect(await prepareVisitServiceReturnPlan(db,user,command)).toEqual({...first,alreadyPrepared:true});
 expect(await db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).toEqual(first.plan);
 expect((await db.collection('visitServiceReturnPlans').get()).size).toBe(1);
 expect((await db.collection('jobs').doc('wash').get()).data()).toEqual(job);expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);expect((await db.collection('carVisits').doc('v').get()).data()).toEqual(visit);expect((await db.collection('visitReceipts').get()).docs[0]!.data()).toEqual(receipt);
 for(const c of['refundRequests','visitServiceReturns','visitCancellationReceipts','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);
});
it('dormant saved return remains an immutable recovery snapshot after change but cannot pass execution revalidation',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan,readCurrentVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 const first=await prepareVisitServiceReturnPlan(db,user,command);await db.collection('jobs').doc('interior').update({updatedAt:'later-work'});
 expect(await prepareVisitServiceReturnPlan(db,user,command)).toEqual({...first,alreadyPrepared:true});
 await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).rejects.toThrow('changed');
 expect((await db.collection('visitServiceReturnPlans').doc(first.plan.id).get()).data()).toEqual(first.plan);
});
it('dormant changed review or operation reason cannot overwrite or prepare a different saved return',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 await prepareVisitServiceReturnPlan(db,user,command);await expect(prepareVisitServiceReturnPlan(db,user,{...command,reason:'Different decision'})).rejects.toThrow('checking');
 const{randomUUID}=await import('node:crypto');await db.collection('jobs').doc('wash').update({updatedAt:'changed'});
 await expect(prepareVisitServiceReturnPlan(db,user,{...command,operationId:randomUUID()})).rejects.toThrow('changed');
 expect((await db.collection('visitServiceReturnPlans').get()).size).toBe(1);
});
it('dormant return journal rejects non-Admin, foreign tenant, extra fields and unreviewed input before any write',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 for(const role of['customer','studio','accountant'])await expect(prepareVisitServiceReturnPlan(db,{...user,claims:{...user.claims,role}}as any,command)).rejects.toMatchObject({code:'permission-denied'});
 await expect(prepareVisitServiceReturnPlan(db,{...user,claims:{...user.claims,tenantId:'other'}},command)).rejects.toMatchObject({code:'not-found'});
 for(const patch of[{reviewed:false},{approveRefund:true},{reason:' x '},{operationId:'invalid'}])await expect(prepareVisitServiceReturnPlan(db,user,{...command,...patch})).rejects.toMatchObject({code:'invalid-argument'});
 expect((await db.collection('visitServiceReturnPlans').get()).empty).toBe(true);
});
it('dormant concurrent return snapshot retries keep one journal identity and no duplicate money',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 const results=await Promise.all([prepareVisitServiceReturnPlan(db,user,command),prepareVisitServiceReturnPlan(db,user,command)]);
 expect(results.map(r=>r.alreadyPrepared).sort()).toEqual([false,true]);expect(results[0]!.plan).toEqual(results[1]!.plan);expect((await db.collection('visitServiceReturnPlans').get()).size).toBe(1);
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant corrupt saved funding cannot be reused as a checked original-method decision',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan,readCurrentVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 const first=await prepareVisitServiceReturnPlan(db,user,command);await db.collection('visitServiceReturnPlans').doc(first.plan.id).update({'review.returnPaise':1});
 await expect(prepareVisitServiceReturnPlan(db,user,command)).rejects.toThrow('checking');await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).rejects.toThrow('checking');
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant saved return cannot execute after another actor, benefit, ownership or transport scope replaces its reviewed state',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan,readCurrentVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');await prepareVisitServiceReturnPlan(db,user,command);
 await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,{...user,uid:'other-admin'},command))).rejects.toThrow('checking');
 await db.collection('bookings').doc('b_wash').update({membershipId:'benefit'});await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).rejects.toThrow();await db.collection('bookings').doc('b_wash').update({membershipId:null});
 await db.collection('carVisits').doc('v').update({transportJobId:'wash'});await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).rejects.toThrow();await db.collection('carVisits').doc('v').update({transportJobId:null});
 await db.collection('vehicles').doc('car').update({ownerId:'other-customer'});await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).rejects.toThrow();
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});

it('dormant journal does not mistake stored map-key order for changed funding evidence',async()=>{
 const{user,command}=await savedReturnFixture(),{prepareVisitServiceReturnPlan,readCurrentVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 const first=await prepareVisitServiceReturnPlan(db,user,command),reorder=(v:any):any=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,value])=>[k,reorder(value)])):v;
 await db.collection('visitServiceReturnPlans').doc(first.plan.id).set(reorder(first.plan));
 expect((await prepareVisitServiceReturnPlan(db,user,command)).plan).toEqual(first.plan);
 expect(await db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).toEqual(first.plan);
});
it('dormant final-service fee-window change invalidates a saved review even without a source-document edit',async()=>{
 await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});
 await db.collection('bookings').doc('b_wash').update({scheduledAt:new Date(Date.now()+8*3600000).toISOString()});
 await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED'});const r:any=await read(),b:any=await prepare(r.reviewToken);await recordVisit(r,b,{receivedPaise:20000});
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js'),{prepareVisitServiceReturnPlan,readCurrentVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js'),{randomUUID}=await import('node:crypto');
 const review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now())),user={uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}}as any;
 const command={visitId:'v',jobId:'wash',operationId:randomUUID(),reviewToken:review.reviewToken,reason:'Final booked work cancelled',reviewed:true};
 expect(review.feePaise).toBe(0);await prepareVisitServiceReturnPlan(db,user,command);
 // Freeze only the policy clock after the journal is written. Firestore still
 // sees the exact original data. No service or receipt time is fabricated.
 const{vi}=await import('vitest');vi.spyOn(Date,'now').mockReturnValue(Date.now()+7*3600000);
 try{await expect(db.runTransaction(tx=>readCurrentVisitServiceReturnPlan(tx,db,user,command))).rejects.toThrow('changed');}finally{vi.restoreAllMocks();}
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});

async function visitProtocolFixture(lostCreate=false) {
 const{vi}=await import('vitest'),{RazorpayVisitProtocol}=await import('../../lib/razorpay-visit-provider.js'),store=await import('../../lib/visit-provider-store.js'),runner=await import('../../lib/visit-provider-runner.js');
 const{command}=await providerClaimInput(),{attempt}=await store.claimVisitProviderAttempt(db,providerUser,command);
 const entity={id:'plink_protocol',order_id:'order_protocol',short_url:'https://rzp.io/i/synthetic-protocol',status:'created',amount:360000,currency:'INR',reference_id:attempt.id,amount_paid:0,payments:[],accept_partial:false,upi_link:false};
 const http=vi.fn(async(input:any):Promise<any>=>{
  if(input.method==='POST'){
   expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).attempt.state).toBe('submitting');
   if(lostCreate)throw Error('Synthetic lost create response');
   return{status:200,body:entity};
  }
  return{status:200,body:input.path.includes('?')?{payment_links:[entity]}:entity};
 });
 const port=new RazorpayVisitProtocol(http);
 return{attempt,entity,http,store,runner,port,run:()=>runner.qualifyVisitProviderSubmission(db,providerUser,'v',attempt.id,port)};
}
it('dormant visit HTTP protocol follows the committed one-submit runner and never sends a booking or notification',async()=>{
 const{run,http,attempt}=await visitProtocolFixture();expect(await run()).toEqual({outcome:'link_bound'});expect(await run()).toEqual({outcome:'link_bound'});
 expect(http.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);expect(http.mock.calls).toHaveLength(2);
 expect(http.mock.calls[0]![0]).toMatchObject({body:{reference_id:attempt.id,amount:360000,currency:'INR',notify:{sms:false,email:false},notes:{visitId:'v',billId:attempt.billId}}});
 expect(JSON.stringify(http.mock.calls)).not.toContain('bookingId');
 for(const c of['payments','visitOnlineReceipts','visitProviderCaptures','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);
});
it('dormant HTTP lookup recovers a lost create from returned reference and independent direct fetch without a second POST',async()=>{
 const{run,http,attempt,runner,port,store}=await visitProtocolFixture(true);
 expect(await run()).toEqual({outcome:'review_required'});expect(await run()).toEqual({outcome:'review_required'});
 expect(await runner.qualifyVisitProviderDiscovery(db,providerUser,'v',attempt.id,port)).toEqual({outcome:'link_bound'});
 expect(http.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);
 expect(http.mock.calls.filter(([r])=>r.method==='GET').map(([r])=>r.path)).toEqual(['/payment_links?reference_id='+attempt.id,'/payment_links/plink_protocol']);
 expect((await store.readVisitProviderRecovery(db,providerUser,'v',attempt.id)).attempt.state).toBe('link_ready');expect((await db.collection('payments').get()).empty).toBe(true);
});
it('dormant HTTP partial or unrelated discovery remains held and no retry may issue another create',async()=>{
 const{run,http,attempt,runner,port,entity}=await visitProtocolFixture(true);await run();
 http.mockResolvedValue({status:200,body:{payment_links:[{...entity,reference_id:'other'}]}});
 expect(await runner.qualifyVisitProviderDiscovery(db,providerUser,'v',attempt.id,port)).toEqual({outcome:'review_required'});
 http.mockResolvedValue({status:200,body:{payment_links:[entity],has_more:true}});
 expect(await runner.qualifyVisitProviderDiscovery(db,providerUser,'v',attempt.id,port)).toEqual({outcome:'review_required'});
 expect(await run()).toEqual({outcome:'review_required'});expect(http.mock.calls.filter(([r])=>r.method==='POST')).toHaveLength(1);
});

async function coveredVisitFixture() {
 const pb={vehicleCategory:'hatchback',basePrice:120000,scopeAdjustment:0,addOns:[],subtotal:120000,membershipDiscount:120000,membershipDiscountPercent:null,pickupFee:0,dropFee:0,taxRatePercent:0,taxDescription:'No tax',tax:0,total:0,currency:'INR'};
 await db.collection('jobs').doc('wash').update({status:'VEHICLE_RECEIVED',isWalkIn:false,totalAmount:0,priceBreakdown:pb,membershipWashUsed:true});
 await db.collection('bookings').doc('b_wash').update({totalAmount:0,priceBreakdown:pb,membershipId:'covered_plan',membershipWashUsed:true,membershipDiscountApplied:true,paymentStatus:'unpaid'});
 await db.collection('services').doc('wash').set({id:'wash',tenantId:'t',name:'Covered wash',category:'washing',membershipWashEligible:true});
 await db.collection('memberships').doc('covered_plan').set({id:'covered_plan',tenantId:'t',customerId:'c',status:'expired',washesUsed:1,washesTotal:1});
 await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').set({id:'wash',tenantId:'t',membershipId:'covered_plan',customerId:'c',usageType:'wash',jobId:'wash',bookingId:'b_wash',valueRedeemed:120000,usedAt:new Date().toISOString()});
 const{settleMembershipCoveredJob}=await import('../../functions/job/settleMembershipCoveredJob.js');
 const settlement:any=await settleMembershipCoveredJob.run(request({jobId:'wash'}));
 return{settlement,invoice:(await db.collection('invoices').doc(settlement.invoiceId).get()).data(),membership:(await db.collection('memberships').doc('covered_plan').get()).data()};
}
it('actual covered zero settlement remains original while an ordinary sibling receives its exact shared final cash and invoice',async()=>{
 const{settlement,invoice,membership}=await coveredVisitFixture();await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});
 const r:any=await read();expect(r).toMatchObject({totalPaise:240000,appliedPaise:0,balancePaise:240000,lines:expect.arrayContaining([expect.objectContaining({jobId:'wash',amountPaise:0,appliedPaise:0,invoiceId:settlement.invoiceId})])});
 const b:any=await prepare(r.reviewToken),receipt:any=await recordVisit(r,b,{receivedPaise:240000});
 expect(receipt.entries).toEqual([{jobId:'interior',appliedPaise:240000}]);expect(await read()).toMatchObject({totalPaise:240000,appliedPaise:240000,balancePaise:0});
 expect((await db.collection('visitInvoices').doc(receipt.invoiceId).get()).data()!.jobIds).toEqual(['interior']);
 expect((await db.collection('invoices').doc(settlement.invoiceId).get()).data()).toEqual(invoice);expect((await db.collection('memberships').doc('covered_plan').get()).data()).toEqual(membership);
 expect((await db.collection('jobs').doc('wash').get()).data()).toMatchObject({paymentStatus:'paid',settlementKind:'membership_covered',invoiceId:settlement.invoiceId});
 expect((await db.collection('payments').get()).empty).toBe(true);
});
it.each(['usage-missing','usage-amount','booking-invoice','booking-unpaid','restored-benefit'])('covered original corruption %s cannot be called paid by the shared money review',async kind=>{
 await coveredVisitFixture();
 if(kind==='usage-missing')await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').delete();
 if(kind==='usage-amount')await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').update({valueRedeemed:1});
 if(kind==='booking-invoice')await db.collection('bookings').doc('b_wash').update({invoiceId:'another-invoice'});
 if(kind==='booking-unpaid')await db.collection('bookings').doc('b_wash').update({paymentStatus:'unpaid'});
 if(kind==='restored-benefit')await db.collection('bookings').doc('b_wash').update({membershipWashUsed:false});
 await expect(read()).rejects.toThrow();expect((await db.collection('visitReceipts').get()).empty).toBe(true);expect((await db.collection('visitInvoices').get()).empty).toBe(true);
});

async function cancelReadyReturn(jobId='wash') {
 const {readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js');
 const {prepareVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js');
 const {cancelReviewedVisitService}=await import('../../lib/visit-service-cancellation.js');
 const {readVisitBilling}=await import('../../lib/visit-billing.js');
 const {randomUUID}=await import('node:crypto');
 const user={uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}}as any;
 const review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v',jobId,Date.now()));
 const command={visitId:'v',jobId,operationId:randomUUID(),reviewToken:review.reviewToken,reason:'Customer changed selected work',reviewed:true,cancelled:true};
 const {cancelled:_,...prepareCommand}=command;
 const plan=await prepareVisitServiceReturnPlan(db,user,prepareCommand);
 return{user,command,review,plan,cancel:()=>cancelReviewedVisitService(db,user,command),billing:()=>db.runTransaction(tx=>readVisitBilling(tx,db,'v'))};
}
it('dormant funded cancellation records an unpaid Admin return review, preserves original money and keeps the sibling collectible',async()=>{
 const {r,b}=await receiptReady();await recordVisit(r,b);const ready=await cancelReadyReturn();
 const sibling=(await db.collection('jobs').doc('interior').get()).data(),original=(await db.collection('visitReceipts').get()).docs[0]!.data(),applications=(await db.collection('offlineReceipts').get()).docs.map(d=>d.data());
 expect(await ready.cancel()).toMatchObject({alreadyCancelled:false,revision:2,feePaise:0,returnReviewPaise:24000,returnedPaise:0,returnStatus:'awaiting_admin'});
 expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);
 expect((await db.collection('visitReceipts').get()).docs[0]!.data()).toEqual(original);
 expect((await db.collection('offlineReceipts').get()).docs.map(d=>d.data())).toEqual(applications);
 expect(await ready.billing()).toMatchObject({returnReviews:[{jobId:'wash',paidPaise:24000,returnPaise:24000,returnedPaise:0,status:'awaiting_admin'}],review:{totalPaise:240000,appliedPaise:48000,balancePaise:192000}});
 expect((await db.collection('bookings').doc('b_wash').get()).data()).toMatchObject({status:'CANCELLED',manualRefundDuePaise:24000,refundStatus:'awaiting_approval',refundedPaise:0});
 for(const c of['refundRequests','paymentEvents','visitProviderAttempts','payments','invoices'])expect((await db.collection(c).get()).empty,c).toBe(true);
 const next:any=await read(),bill:any=await prepare(next.reviewToken),settled:any=await recordVisit(next,bill,{receivedPaise:192000});
 expect(settled.entries).toEqual([{jobId:'interior',appliedPaise:192000}]);expect((await db.collection('visitInvoices').doc(settled.invoiceId).get()).data()!.jobIds).toEqual(['interior']);
 expect((await ready.billing()).review).toMatchObject({totalPaise:240000,appliedPaise:240000,balancePaise:0});
});
it('dormant fully paid service cancellation leaves its issued invoice and original payment byte-for-byte unchanged',async()=>{
 await paid();const ready=await cancelReadyReturn(),invoice=(await db.collection('invoices').doc('i').get()).data(),paymentBefore=(await db.collection('payments').doc('p').get()).data();
 await ready.cancel();expect((await db.collection('invoices').doc('i').get()).data()).toEqual(invoice);expect((await db.collection('payments').doc('p').get()).data()).toEqual(paymentBefore);
 expect(await ready.billing()).toMatchObject({returnReviews:[{jobId:'wash',invoiceId:'i',returnPaise:120000,returnedPaise:0}],review:{balancePaise:240000}});
});
it('dormant fully settled shared online cancellation keeps original capture and shared invoice identities while removing only its obligation',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const next:any=await read(),bill:any=await prepare(next.reviewToken),settled=await settleCurrentOnline(next,bill),invoice=(await db.collection('visitInvoices').doc(settled.invoiceId).get()).data();
 const ready=await cancelReadyReturn();expect(ready.review.entries).toEqual(expect.arrayContaining([expect.objectContaining({providerPaymentId:'pay_current',capturedPaise:96000,returnPaise:96000})]));
 await ready.cancel();expect((await db.collection('visitInvoices').doc(settled.invoiceId).get()).data()).toEqual(invoice);
 expect(await ready.billing()).toMatchObject({returnReviews:[{jobId:'wash',returnPaise:120000,returnedPaise:0}],review:{totalPaise:240000,appliedPaise:240000,balancePaise:0}});
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant cancellation exact retry is one transition and one awaiting-approval identity even concurrently',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const ready=await cancelReadyReturn(),results=await Promise.all([ready.cancel(),ready.cancel()]);
 expect(results.map(r=>r.alreadyCancelled).sort()).toEqual([false,true]);expect(results[0]).toEqual({...results[1],alreadyCancelled:results[0]!.alreadyCancelled});
 expect((await db.collection('visitServiceReturns').get()).size).toBe(1);expect((await db.collection('carVisits').doc('v').get()).data()!.revision).toBe(2);
 expect(await ready.cancel()).toMatchObject({alreadyCancelled:true,returnReviewPaise:24000,returnedPaise:0});
});
it('dormant cancellation rejects a stale saved review without changing the service or making a return',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const ready=await cancelReadyReturn();await db.collection('jobs').doc('interior').update({updatedAt:'changed-work'});
 await expect(ready.cancel()).rejects.toThrow('changed');expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('VEHICLE_RECEIVED');expect((await db.collection('visitServiceReturns').get()).empty).toBe(true);
});
it.each(['money','invoice','return-record','saved-review','booking-marker','job-marker'])('dormant cancellation %s corruption never makes a false sibling payable balance',async kind=>{
 await paid();const ready=await cancelReadyReturn();await ready.cancel();
 if(kind==='money')await db.collection('payments').doc('p').update({amount:119999});
 if(kind==='invoice')await db.collection('invoices').doc('i').update({invoiceNumber:'CHANGED'});
 if(kind==='return-record')await db.collection('visitServiceReturns').doc('wash').update({reviewHash:'0'.repeat(64)});
 if(kind==='saved-review')await db.collection('visitServiceReturnPlans').doc(ready.plan.plan.id).update({'review.returnPaise':1});
 if(kind==='booking-marker')await db.collection('bookings').doc('b_wash').update({visitServiceReturnId:'other'});
 if(kind==='job-marker')await db.collection('jobs').doc('wash').update({visitServiceReturnId:'other'});
 await expect(ready.billing()).rejects.toBeDefined();expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant cancellation follows no-fee sibling then existing final-service fee without reallocating the first return',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const first=await cancelReadyReturn();await first.cancel();const original=(await db.collection('visitServiceReturns').doc('wash').get()).data();
 const second=await cancelReadyReturn('interior');expect(second.review).toMatchObject({feeReason:'last_service_policy',feePaise:10000,paidPaise:48000,retainedPaise:10000,returnPaise:38000,feeDuePaise:0});
 await second.cancel();expect((await db.collection('visitServiceReturns').doc('wash').get()).data()).toEqual(original);
 expect(await second.billing()).toMatchObject({returnReviews:expect.arrayContaining([expect.objectContaining({jobId:'wash',returnPaise:24000}),expect.objectContaining({jobId:'interior',retainedPaise:10000,returnPaise:38000})]),review:{totalPaise:0,appliedPaise:0,balancePaise:0}});
 expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant cancellation will not hide a final outstanding fee or close an existing physical request',async()=>{
 await receiptReady();await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});
 const r:any=await read(),b:any=await prepare(r.reviewToken);await recordVisit(r,b,{receivedPaise:5000});const ready=await cancelReadyReturn();expect(ready.review.feeDuePaise).toBe(5000);
 await expect(ready.cancel()).rejects.toThrow('outstanding');expect((await db.collection('visitServiceReturns').get()).empty).toBe(true);
});
it('dormant cancellation rejects changed reason, other actor, foreign tenant and missing confirmation',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const ready=await cancelReadyReturn(),{cancelReviewedVisitService}=await import('../../lib/visit-service-cancellation.js');
 for(const role of['studio','customer','accountant'])await expect(cancelReviewedVisitService(db,{...ready.user,claims:{...ready.user.claims,role}},ready.command)).rejects.toMatchObject({code:'permission-denied'});
 await expect(cancelReviewedVisitService(db,{...ready.user,uid:'other'},ready.command)).rejects.toThrow();
 await expect(cancelReviewedVisitService(db,{...ready.user,claims:{...ready.user.claims,tenantId:'other'}},ready.command)).rejects.toMatchObject({code:'not-found'});
 await expect(cancelReviewedVisitService(db,ready.user,{...ready.command,cancelled:false})).rejects.toMatchObject({code:'invalid-argument'});
 await expect(cancelReviewedVisitService(db,ready.user,{...ready.command,reason:'Different decision'})).rejects.toThrow();
 expect((await db.collection('visitServiceReturns').get()).empty).toBe(true);
});
it('dormant cancellation never closes even a declined physical request or restores a hidden benefit',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const ready=await cancelReadyReturn();
 const request={id:'b_wash',bookingId:'b_wash',jobId:'wash',tenantId:'t',studioId:'s',customerId:'c',status:'DECLINED',memberMembershipId:'held'};
 await db.collection('pickupRequests').doc('b_wash').set(request);await expect(ready.cancel()).rejects.toThrow();
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(request);expect((await db.collection('visitServiceReturns').get()).empty).toBe(true);
});
it('dormant cancellation serializes two saved service decisions so only one can use the sibling fee waiver',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const wash=await cancelReadyReturn(),interior=await cancelReadyReturn('interior');
 const results=await Promise.allSettled([wash.cancel(),interior.cancel()]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect((await db.collection('visitServiceReturns').get()).size).toBe(1);expect((await db.collection('carVisits').doc('v').get()).data()!.revision).toBe(2);
});
it('dormant cancellation respects customer erasure before committing',async()=>{
 const{r,b}=await receiptReady();await recordVisit(r,b);const ready=await cancelReadyReturn();
 await db.collection('customers').doc('c').update({erasureState:'pending',deletedAt:'erasing'});await expect(ready.cancel()).rejects.toBeDefined();
 expect((await db.collection('visitServiceReturns').get()).empty).toBe(true);
});

async function transportReturnFixture(){
 const pb={vehicleCategory:'hatchback',basePrice:120000,scopeAdjustment:0,addOns:[],subtotal:123003,membershipDiscount:0,membershipDiscountPercent:null,pickupFee:1001,dropFee:2002,taxRatePercent:18,taxDescription:'GST',tax:22141,total:145144,currency:'INR'};
 await db.collection('jobs').doc('wash').update({priceBreakdown:pb,totalAmount:pb.total,status:'VEHICLE_RECEIVED'});
 await db.collection('bookings').doc('b_wash').update({priceBreakdown:pb,totalAmount:pb.total});
 await db.collection('carVisits').doc('v').update({transportJobId:'wash'});
 const request={id:'b_wash',bookingId:'b_wash',jobId:'wash',visitId:'v',tenantId:'t',studioId:'s',customerId:'c',kind:'both',status:'CONFIRMED',feePaise:3003,pickupFeePaise:1001,dropFeePaise:2002,feeBilled:true,billingVersion:2,pickupCompletedAt:'2026-11-15T00:30:00.000Z',dropCompletedAt:null,legs:[{leg:'pickup',feePaise:1001,roadMeters:1},{leg:'drop',feePaise:2002,roadMeters:2}]};
 await db.collection('pickupRequests').doc('b_wash').set(request);
 const {readVisitTransportReturnReview}=await import('../../lib/visit-transport-return-review.js');
 return{pb,request,read:(legs:('pickup'|'drop')[]=[])=>db.runTransaction(tx=>readVisitTransportReturnReview(tx,db,'v','wash',legs))};
}
it('dormant transport review retains one exact original physical request and fee with no sibling reprice or money effect',async()=>{
 const f=await transportReturnFixture(),sibling=(await db.collection('jobs').doc('interior').get()).data(),visit=(await db.collection('carVisits').doc('v').get()).data();
 const review=await f.read();expect(review).toMatchObject({requestId:'b_wash',continuingJobIds:['interior'],completedLegs:['pickup'],proposedUnusedLegs:[],retainedLegs:['pickup','drop'],needsUnusedLegDecision:false,originalTotalPaise:145144,retainedTransportPaise:3544,unusedTransportReviewPaise:0});
 expect(review.components.service.totalPaise+review.retainedTransportPaise).toBe(f.pb.total);
 expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);expect((await db.collection('carVisits').doc('v').get()).data()).toEqual(visit);
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(f.request);
 for(const c of['refundRequests','visitServiceReturns','payments','visitInvoices'])expect((await db.collection(c).get()).empty,c).toBe(true);
});
it('dormant unused-leg proposal is exact Admin review only and can never include a completed leg',async()=>{
 const f=await transportReturnFixture(),kept=await f.read(),unused=await f.read(['drop']);
 expect(unused).toMatchObject({completedLegs:['pickup'],proposedUnusedLegs:['drop'],retainedLegs:['pickup'],retainedTransportPaise:1181,unusedTransportReviewPaise:2363});
 expect(unused.reviewToken).not.toBe(kept.reviewToken);await expect(f.read(['pickup'])).rejects.toThrow();await expect(f.read(['drop','drop'])).rejects.toThrow();
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(f.request);
});
it('dormant final-service transport review requires an explicit unused-leg choice and never auto-closes the car return',async()=>{
 const f=await transportReturnFixture();await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});
 expect(await f.read()).toMatchObject({continuingJobIds:[],needsUnusedLegDecision:true,retainedLegs:['pickup','drop']});
 expect(await f.read(['drop'])).toMatchObject({needsUnusedLegDecision:false,completedLegs:['pickup'],proposedUnusedLegs:['drop']});
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()!.status).toBe('CONFIRMED');
});
it('dormant DONE transport without historical per-leg stamps is used, never two unused legs',async()=>{
 const f=await transportReturnFixture();await db.collection('pickupRequests').doc('b_wash').update({status:'DONE',pickupCompletedAt:null,dropCompletedAt:null});
 expect(await f.read()).toMatchObject({completedLegs:['pickup','drop'],retainedLegs:['pickup','drop']});await expect(f.read(['drop'])).rejects.toThrow();
});
it.each([{feePaise:3004},{pickupFeePaise:1000},{memberMembershipId:'benefit'},{memberBenefitState:'reserved'},{studioId:'other'},{jobId:'interior'},{status:'DECLINED'},{dropCompletedAt:'invalid'},{feeBilled:false},{legs:[{leg:'pickup',feePaise:1502},{leg:'drop',feePaise:1501}]}])('dormant transport review refuses inconsistent source %j',async patch=>{
 const f=await transportReturnFixture();await db.collection('pickupRequests').doc('b_wash').update(patch);await expect(f.read()).rejects.toThrow();expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant transport review binds live leg progress and rejects a second hidden physical request',async()=>{
 const f=await transportReturnFixture(),before=await f.read(['drop']);await db.collection('pickupRequests').doc('b_wash').update({dropCompletedAt:'2026-11-15T00:40:00.000Z'});
 const after=await f.read();expect(after.reviewToken).not.toBe(before.reviewToken);await expect(f.read(['drop'])).rejects.toThrow();
 await db.collection('pickupRequests').doc('hidden').set({...f.request,id:'hidden'});await expect(f.read()).rejects.toThrow();
});
it('dormant transport review refuses a changed booking price even when the request still matches the job',async()=>{
 const f=await transportReturnFixture();await db.collection('bookings').doc('b_wash').update({'priceBreakdown.dropFee':2001});await expect(f.read()).rejects.toThrow();
});
it('dormant transport quote snapshot cannot be replaced with a new leg split while cancelling one service',async()=>{
 const f=await transportReturnFixture(),snapshot={quoteId:'original_quote',kind:'both',feePaise:3003,pickupFeePaise:1001,dropFeePaise:2002,legs:f.request.legs};
 await db.collection('jobs').doc('wash').update({transportSnapshot:snapshot});await db.collection('bookings').doc('b_wash').update({transportSnapshot:snapshot});await db.collection('pickupRequests').doc('b_wash').update({quoteId:'original_quote'});
 expect(await f.read()).toMatchObject({retainedTransportPaise:3544});await db.collection('pickupRequests').doc('b_wash').update({quoteId:'new_quote'});await expect(f.read()).rejects.toThrow();
});

async function manualReturnReady(mixed=false){
 const{r,b}=await receiptReady();await recordVisit(r,b);
 if(mixed){const next:any=await read(),bill:any=await prepare(next.reviewToken);await settleCurrentOnline(next,bill);}
 const ready=await cancelReadyReturn();await ready.cancel();
 const api=await import('../../lib/visit-service-manual-return.js');
 const progress=async()=>(await ready.billing()).returnReviews.find(r=>r.jobId==='wash')!;
 const approveCommand={visitId:'v',jobId:'wash',progressToken:(await progress()).progressToken,note:'Admin reviewed original methods',approved:true};
 return{...ready,...api,progress,approveCommand,approve:()=>api.approveVisitServiceReturn(db,ready.user,approveCommand)};
}
it('dormant separate Admin return approval moves no money and cannot be confused with cancellation or actual manual return',async()=>{
 const f=await manualReturnReady(),before=await f.progress();
 const entry=before.entries.find(e=>e.method==='cash')!;
 await expect(f.recordVisitServiceManualReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:entry.key,progressToken:before.progressToken,note:'Actual cash handed back',returned:true})).rejects.toThrow('separate Admin approval');
 expect(await f.approve()).toMatchObject({alreadyApproved:false,returnedPaise:0});expect(await f.approve()).toMatchObject({alreadyApproved:true,returnedPaise:0});
 expect(await f.progress()).toMatchObject({status:'approved',returnPaise:24000,returnedPaise:0,manualDuePaise:24000,onlineDuePaise:0});
 expect((await db.collection('visitServiceManualReturns').get()).empty).toBe(true);expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it.each(['cash','upi_manual','bank_transfer'])('dormant actual %s return is source-bound after separate Admin approval with immutable receipt and sibling money',async method=>{
 const{r,b}=await receiptReady();await recordVisit(r,b,{method});const ready=await cancelReadyReturn();await ready.cancel();
 const {approveVisitServiceReturn,recordVisitServiceManualReturn}=await import('../../lib/visit-service-manual-return.js');
 const progress=async()=>(await ready.billing()).returnReviews[0]!,before=await progress(),entry=before.entries[0]!;
 const sibling=(await db.collection('jobs').doc('interior').get()).data(),receipts=(await db.collection('offlineReceipts').get()).docs.map(d=>d.data()),parent=(await db.collection('visitReceipts').get()).docs[0]!.data();
 await approveVisitServiceReturn(db,ready.user,{visitId:'v',jobId:'wash',progressToken:before.progressToken,note:'Admin reviewed original return',approved:true});
 const command={visitId:'v',jobId:'wash',entryKey:entry.key,progressToken:(await progress()).progressToken,note:'Actual original-method amount returned',returned:true};
 expect(await recordVisitServiceManualReturn(db,ready.user,command)).toMatchObject({alreadyRecorded:false,amountPaise:24000});
 expect(await recordVisitServiceManualReturn(db,ready.user,command)).toMatchObject({alreadyRecorded:true,amountPaise:24000});
 expect(await progress()).toMatchObject({status:'returned',returnPaise:24000,returnedPaise:24000,manualDuePaise:0,onlineDuePaise:0,accountingReviewNeeded:true});
 expect((await db.collection('bookings').doc('b_wash').get()).data()).toMatchObject({refundStatus:'processed',refundedPaise:24000,manualRefundDuePaise:0,returnAccountingReviewNeeded:true});
 expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);expect((await db.collection('offlineReceipts').get()).docs.map(d=>d.data())).toEqual(receipts);expect((await db.collection('visitReceipts').get()).docs[0]!.data()).toEqual(parent);
 expect((await ready.billing()).review).toMatchObject({appliedPaise:48000,balancePaise:192000});expect((await db.collection('visitServiceManualReturns').get()).size).toBe(1);
});
it('dormant mixed manual return never reports the unsubmitted online share returned or queues a legacy provider refund',async()=>{
 const f=await manualReturnReady(true),original=(await db.collection('visitInvoices').get()).docs[0]!.data();await f.approve();const p=await f.progress(),cash=p.entries.find(e=>e.method==='cash')!,online=p.entries.find(e=>e.method==='razorpay_payment_link')!;
 expect(p).toMatchObject({returnedPaise:0,manualDuePaise:24000,onlineDuePaise:96000});
 await expect(f.recordVisitServiceManualReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:online.key,progressToken:p.progressToken,note:'Cannot claim provider money',returned:true})).rejects.toThrow();
 await f.recordVisitServiceManualReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:cash.key,progressToken:p.progressToken,note:'Original cash handover returned',returned:true});
 expect(await f.progress()).toMatchObject({status:'partly_returned',returnedPaise:24000,manualDuePaise:0,onlineDuePaise:96000});
 expect((await db.collection('visitInvoices').get()).docs[0]!.data()).toEqual(original);expect((await db.collection('refundRequests').get()).empty).toBe(true);expect((await db.collection('paymentEvents').get()).empty).toBe(true);
});
it('dormant concurrent actual manual confirmations record one handover fact, not double returned money',async()=>{
 const f=await manualReturnReady();await f.approve();const p=await f.progress(),command={visitId:'v',jobId:'wash',entryKey:p.entries[0]!.key,progressToken:p.progressToken,note:'One actual cash handover',returned:true};
 const results=await Promise.all([f.recordVisitServiceManualReturn(db,f.user,command),f.recordVisitServiceManualReturn(db,f.user,command)]);
 expect(results.map(r=>r.alreadyRecorded).sort()).toEqual([false,true]);expect((await db.collection('visitServiceManualReturns').get()).size).toBe(1);expect(await f.progress()).toMatchObject({returnedPaise:24000});
});
it.each(['approval','actual-amount','actual-method','actual-source','projection'])('dormant return evidence %s corruption cannot create a false remaining balance',async kind=>{
 const f=await manualReturnReady();await f.approve();const p=await f.progress();await f.recordVisitServiceManualReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:p.entries[0]!.key,progressToken:p.progressToken,note:'Actual returned original cash',returned:true});
 const row=(await db.collection('visitServiceManualReturns').get()).docs[0]!;
 if(kind==='approval')await db.collection('visitServiceReturnApprovals').doc('wash').update({returnPaise:1});
 if(kind==='actual-amount')await row.ref.update({amountPaise:1});
 if(kind==='actual-method')await row.ref.update({method:'upi_manual'});
 if(kind==='actual-source')await row.ref.update({entryKey:'other'});
 if(kind==='projection')await db.collection('bookings').doc('b_wash').update({refundedPaise:1});
 await expect(f.billing()).rejects.toThrow();
});
it('dormant return approval and actual handover require exact token, explicit confirmation and Admin actor',async()=>{
 const f=await manualReturnReady();for(const role of['customer','studio','accountant'])await expect(f.approveVisitServiceReturn(db,{...f.user,claims:{...f.user.claims,role}},f.approveCommand)).rejects.toMatchObject({code:'permission-denied'});
 await expect(f.approveVisitServiceReturn(db,f.user,{...f.approveCommand,approved:false})).rejects.toMatchObject({code:'invalid-argument'});
 await expect(f.approveVisitServiceReturn(db,f.user,{...f.approveCommand,progressToken:'0'.repeat(64)})).rejects.toThrow();
 await f.approve();const p=await f.progress(),command={visitId:'v',jobId:'wash',entryKey:p.entries[0]!.key,progressToken:p.progressToken,note:'Actual cash returned',returned:true};
 await expect(f.recordVisitServiceManualReturn(db,f.user,{...command,progressToken:'0'.repeat(64)})).rejects.toThrow();
 await expect(f.recordVisitServiceManualReturn(db,f.user,{...command,returned:false})).rejects.toMatchObject({code:'invalid-argument'});
 expect((await db.collection('visitServiceManualReturns').get()).empty).toBe(true);
});
it('dormant cancelled original payment is claimed against competing legacy manual and provider returns',async()=>{
 await paid();const ready=await cancelReadyReturn();await ready.cancel();
 expect((await db.collection('paymentEvents').doc('refund_p').get()).data()).toMatchObject({kind:'visit_service_return_owned',paymentId:'p',jobId:'wash',returnId:'wash'});
 const{settleManualRefund}=await import('../../functions/payment/settleManualRefund.js');await expect(settleManualRefund.run(request({paymentId:'p',note:'Must not double return'}))).rejects.toThrow();
 const{planReserveInTx}=await import('../../lib/refund-outbox.js');const payment=(await db.collection('payments').doc('p').get()).data();
 expect(await db.runTransaction(tx=>planReserveInTx(tx,db,{payment:payment as any,amountPaise:120000,reason:'Must not reserve duplicate',createdBy:'staff'}))).toMatchObject({ok:false});
 const before=(await ready.billing()).returnReviews[0]!;const{approveVisitServiceReturn,recordVisitServiceManualReturn}=await import('../../lib/visit-service-manual-return.js');
 await approveVisitServiceReturn(db,ready.user,{visitId:'v',jobId:'wash',progressToken:before.progressToken,note:'Admin reviewed original payment',approved:true});
 const current=(await ready.billing()).returnReviews[0]!;await recordVisitServiceManualReturn(db,ready.user,{visitId:'v',jobId:'wash',progressToken:current.progressToken,entryKey:current.entries[0]!.key,note:'Actual original cash returned',returned:true});
 expect((await ready.billing()).returnReviews[0]).toMatchObject({returnedPaise:120000,status:'returned'});
 await db.collection('paymentEvents').doc('refund_p').delete();await expect(ready.billing()).rejects.toThrow();
});

async function onlineReturnReady(){
 const f=await manualReturnReady(true);await f.approve();const progress=await f.progress(),entry=progress.entries.find(e=>e.method==='razorpay_payment_link')!;
 const api=await import('../../lib/visit-online-return.js'),command={visitId:'v',jobId:'wash',entryKey:entry.key,progressToken:progress.progressToken,reserved:true};
 const{vi}=await import('vitest'),evidence={id:'rfnd_visit',paymentId:'pay_current',amountPaise:96000,currency:'INR',referenceId:'',status:'processed'};
 const port={create:vi.fn(async(_input:any)=>({id:evidence.id})),fetch:vi.fn(async(_id:string):Promise<any>=>evidence),discover:vi.fn(async()=>({complete:true,refunds:[evidence]}))};
 const reserve=async()=>{const r=await api.reserveVisitOnlineReturn(db,f.user,command);evidence.referenceId=r.request.id;return r;};
 return{...f,...api,entry,command,evidence,port,reserve};
}
it('dormant online return reserves only its approved source and global capture share, with no actual returned amount or provider call',async()=>{
 const f=await onlineReturnReady(),r=await f.reserve();expect(r).toMatchObject({alreadyReserved:false,request:{state:'reserved',amountPaise:96000,captureAmountPaise:288000,providerPaymentId:'pay_current',jobId:'wash'}});
 expect(await f.reserve()).toMatchObject({alreadyReserved:true,request:{id:r.request.id}});expect(f.port.create).not.toHaveBeenCalled();
 expect(await f.progress()).toMatchObject({returnedPaise:0,manualDuePaise:24000,onlineDuePaise:96000});expect((await db.collection('visitServiceOnlineReturns').get()).size).toBe(1);
});
it('dormant online return commits its first-submit state before one create and independently verifies exact processed evidence',async()=>{
 const f=await onlineReturnReady(),r=await f.reserve(),invoice=(await db.collection('visitInvoices').get()).docs[0]!.data();
 f.port.create.mockImplementation(async(input:any)=>{expect((await db.collection('visitServiceOnlineReturns').doc(r.request.id).get()).data()!.state).toBe('submitting');expect(input).toEqual({providerPaymentId:'pay_current',amountPaise:96000,currency:'INR',referenceId:r.request.id});return{id:f.evidence.id};});
 expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'returned'});
 expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'returned'});expect(f.port.create).toHaveBeenCalledTimes(1);expect(f.port.fetch).toHaveBeenCalledTimes(1);
 expect(await f.progress()).toMatchObject({status:'partly_returned',returnedPaise:96000,manualDuePaise:24000,onlineDuePaise:0,accountingReviewNeeded:true});
 expect((await db.collection('visitInvoices').get()).docs[0]!.data()).toEqual(invoice);expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant lost online refund response is discovery-only recovery, never a second create or released balance',async()=>{
 const f=await onlineReturnReady(),r=await f.reserve();f.port.create.mockRejectedValueOnce(Error('Synthetic lost response'));
 expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'review_required'});
 expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'review_required'});expect(f.port.create).toHaveBeenCalledTimes(1);
 expect(await f.reconcileVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'returned'});expect(f.port.create).toHaveBeenCalledTimes(1);expect(f.port.discover).toHaveBeenCalledTimes(1);expect(f.port.fetch).toHaveBeenCalledTimes(1);
});
it.each([{status:'pending'},{status:'failed'},{amountPaise:96001},{paymentId:'pay_other'},{referenceId:'other'},{currency:'USD'}])('dormant online refund entity %j stays held and never reports returned or retries create',async patch=>{
 const f=await onlineReturnReady(),r=await f.reserve();f.port.fetch.mockResolvedValue({...f.evidence,...patch});
 expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'review_required'});expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'review_required'});
 expect(f.port.create).toHaveBeenCalledTimes(1);expect(await f.progress()).toMatchObject({returnedPaise:0,onlineDuePaise:96000});expect((await db.collection('visitServiceOnlineReturns').doc(r.request.id).get()).data()!.state).toBe('review_required');
});
it.each(['empty','partial','multiple','wrong-source'])('dormant online refund discovery %s cannot release/recreate or mark money returned',async kind=>{
 const f=await onlineReturnReady(),r=await f.reserve();f.port.create.mockRejectedValueOnce(Error('Synthetic lost response'));await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port);
 f.port.discover.mockResolvedValue({complete:kind!=='partial',refunds:kind==='empty'?[]:kind==='multiple'?[f.evidence,{...f.evidence,id:'rfnd_second'}]:kind==='wrong-source'?[{...f.evidence,paymentId:'other'}]:[f.evidence]});
 expect(await f.reconcileVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'review_required'});expect(f.port.create).toHaveBeenCalledTimes(1);expect(f.port.fetch).not.toHaveBeenCalled();expect(await f.progress()).toMatchObject({returnedPaise:0,onlineDuePaise:96000});
});
it('dormant concurrent online reservations and runners preserve one request, one create and one capture claim',async()=>{
 const f=await onlineReturnReady(),reservations=await Promise.all([f.reserve(),f.reserve()]);expect(reservations.map(r=>r.alreadyReserved).sort()).toEqual([false,true]);
 const r=reservations[0]!,results=await Promise.all([f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port),f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)]);
 expect(results.some(r=>r.outcome==='returned')).toBe(true);expect(f.port.create).toHaveBeenCalledTimes(1);expect((await db.collection('visitServiceOnlineReturns').get()).size).toBe(1);expect((await db.collection('visitServiceProviderRefunds').get()).size).toBe(1);
});
it('dormant both service returns share one global original capture and never reserve the sibling amount twice',async()=>{
 const f=await onlineReturnReady(),first=await f.reserve(),sibling=await cancelReadyReturn('interior');await sibling.cancel();
 const{approveVisitServiceReturn}=await import('../../lib/visit-service-manual-return.js'),before=(await sibling.billing()).returnReviews.find(r=>r.jobId==='interior')!;
 await approveVisitServiceReturn(db,f.user,{visitId:'v',jobId:'interior',progressToken:before.progressToken,note:'Admin reviewed sibling return',approved:true});
 const next=(await sibling.billing()).returnReviews.find(r=>r.jobId==='interior')!,entry=next.entries.find(e=>e.method==='razorpay_payment_link')!;
 const second=await f.reserveVisitOnlineReturn(db,f.user,{visitId:'v',jobId:'interior',entryKey:entry.key,progressToken:next.progressToken,reserved:true});expect(second.request).toMatchObject({amountPaise:192000,captureAmountPaise:288000,providerPaymentId:'pay_current'});
 const guards=(await db.collection('visitServiceOnlineReturnCaptures').get()).docs;expect(guards).toHaveLength(1);expect(guards[0]!.data().claims.map((c:any)=>c.amountPaise).sort()).toEqual([192000,96000]);
 expect(first.request.id).not.toBe(second.request.id);expect((await sibling.billing()).review.balancePaise).toBe(0);
});
it('dormant provider refund identity cannot be reused across two service returns',async()=>{
 const f=await onlineReturnReady(),first=await f.reserve();await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',first.request.id,f.port);
 const sibling=await cancelReadyReturn('interior');await sibling.cancel();const{approveVisitServiceReturn}=await import('../../lib/visit-service-manual-return.js');let p=(await sibling.billing()).returnReviews.find(r=>r.jobId==='interior')!;
 await approveVisitServiceReturn(db,f.user,{visitId:'v',jobId:'interior',progressToken:p.progressToken,note:'Admin reviewed sibling original',approved:true});p=(await sibling.billing()).returnReviews.find(r=>r.jobId==='interior')!;
 const entry=p.entries.find(e=>e.method==='razorpay_payment_link')!,second=await f.reserveVisitOnlineReturn(db,f.user,{visitId:'v',jobId:'interior',entryKey:entry.key,progressToken:p.progressToken,reserved:true});
 f.port.fetch.mockResolvedValue({...f.evidence,amountPaise:192000,referenceId:second.request.id});expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','interior',second.request.id,f.port)).toEqual({outcome:'review_required'});
 expect((await sibling.billing()).returnReviews.find(r=>r.jobId==='interior')).toMatchObject({returnedPaise:0,onlineDuePaise:192000});expect((await db.collection('visitServiceProviderRefunds').get()).size).toBe(1);
});
it('dormant actual manual handover can finish after online return without rewriting capture or invoice',async()=>{
 const f=await onlineReturnReady(),r=await f.reserve();await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port);const p=await f.progress(),cash=p.entries.find(e=>e.method==='cash')!;
 await f.recordVisitServiceManualReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:cash.key,progressToken:p.progressToken,note:'Actual remaining cash handed back',returned:true});expect(await f.progress()).toMatchObject({status:'returned',returnedPaise:120000,manualDuePaise:0,onlineDuePaise:0});
});
it('dormant online reservation needs separate approval, current token, original online source and Admin role',async()=>{
 const f=await onlineReturnReady();for(const role of['customer','studio','accountant'])await expect(f.reserveVisitOnlineReturn(db,{...f.user,claims:{...f.user.claims,role}},f.command)).rejects.toMatchObject({code:'permission-denied'});
 await expect(f.reserveVisitOnlineReturn(db,f.user,{...f.command,progressToken:'0'.repeat(64)})).rejects.toThrow();
 await expect(f.reserveVisitOnlineReturn(db,f.user,{...f.command,reserved:false})).rejects.toMatchObject({code:'invalid-argument'});
 const cash=(await f.progress()).entries.find(e=>e.method==='cash')!;await expect(f.reserveVisitOnlineReturn(db,f.user,{...f.command,entryKey:cash.key})).rejects.toThrow();expect((await db.collection('visitServiceOnlineReturns').get()).empty).toBe(true);
});
it.each(['capture-amount','capture-owner','claim-amount','request-amount','processed-without-identity'])('dormant online return %s corruption never fabricates returned money or a collectable sibling balance',async kind=>{
 const f=await onlineReturnReady(),r=await f.reserve(),guard=(await db.collection('visitServiceOnlineReturnCaptures').get()).docs[0]!;
 if(kind==='capture-amount')await guard.ref.update({captureAmountPaise:288001});
 if(kind==='capture-owner')await guard.ref.update({customerId:'other'});
 if(kind==='claim-amount')await guard.ref.update({claims:[{...guard.data().claims[0],amountPaise:96001}]});
 if(kind==='request-amount')await db.collection('visitServiceOnlineReturns').doc(r.request.id).update({amountPaise:96001});
 if(kind==='processed-without-identity')await db.collection('visitServiceOnlineReturns').doc(r.request.id).update({state:'returned',candidateId:f.evidence.id,evidence:f.evidence});
 await expect(f.billing()).rejects.toThrow();expect(f.port.create).not.toHaveBeenCalled();
});
it('dormant pending online refund can later reconcile processed with the same reference, no second create',async()=>{
 const f=await onlineReturnReady(),r=await f.reserve();f.port.fetch.mockResolvedValueOnce({...f.evidence,status:'pending'});
 expect(await f.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'review_required'});
 expect(await f.reconcileVisitOnlineReturn(db,f.user,'v','wash',r.request.id,f.port)).toEqual({outcome:'returned'});expect(f.port.create).toHaveBeenCalledTimes(1);expect(f.port.fetch).toHaveBeenCalledTimes(2);
});
it('dormant individual original provider payment uses its claimed legacy identity, not a fabricated shared application',async()=>{
 await paid();await db.collection('payments').doc('p').update({method:'razorpay_payment_link',razorpayPaymentId:'pay_legacy'});
 const f=await cancelReadyReturn();await f.cancel();const{approveVisitServiceReturn}=await import('../../lib/visit-service-manual-return.js');let p=(await f.billing()).returnReviews[0]!;
 await approveVisitServiceReturn(db,f.user,{visitId:'v',jobId:'wash',progressToken:p.progressToken,note:'Admin reviewed original online capture',approved:true});p=(await f.billing()).returnReviews[0]!;
 const api=await import('../../lib/visit-online-return.js'),e=p.entries[0]!,r=await api.reserveVisitOnlineReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:e.key,progressToken:p.progressToken,reserved:true});
 expect(r.request).toMatchObject({paymentId:'p',originalReceiptId:null,captureAmountPaise:120000,amountPaise:120000,providerPaymentId:'pay_legacy'});
 const evidence={id:'rfnd_legacy',paymentId:'pay_legacy',referenceId:r.request.id,amountPaise:120000,currency:'INR',status:'processed'};
 expect(await api.qualifyVisitOnlineReturn(db,f.user,'v','wash',r.request.id,{create:async()=>({id:evidence.id}),fetch:async()=>evidence,discover:async()=>({complete:true,refunds:[evidence]})})).toEqual({outcome:'returned'});
 expect((await f.billing()).returnReviews[0]).toMatchObject({returnedPaise:120000,status:'returned'});expect((await db.collection('payments').doc('p').get()).data()).toMatchObject({status:'completed',amount:120000,razorpayPaymentId:'pay_legacy'});
});

async function retainedTransportReady(unusedLegs:('pickup'|'drop')[]=[]){
 const source=await transportReturnFixture();await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});
 const bill:any=await read(),prepared:any=await prepare(bill.reviewToken);await recordVisit(bill,prepared,{receivedPaise:385144});
 const transport=await source.read(unusedLegs),{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js'),{prepareVisitServiceReturnPlan}=await import('../../lib/visit-service-return-plan.js'),{cancelReviewedVisitService}=await import('../../lib/visit-service-cancellation.js'),{readVisitBilling}=await import('../../lib/visit-billing.js'),{randomUUID}=await import('node:crypto');
 const user={uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}}as any,choice={reviewToken:transport.reviewToken,unusedLegs};
 const review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now(),choice)),command={visitId:'v',jobId:'wash',operationId:randomUUID(),reviewToken:review.reviewToken,reason:'One service cancelled, keep needed trip',reviewed:true,transport:choice};
 const plan=await prepareVisitServiceReturnPlan(db,user,command);
 return{...source,user,review,command,plan,cancel:()=>cancelReviewedVisitService(db,user,{...command,cancelled:true}),billing:()=>db.runTransaction(tx=>readVisitBilling(tx,db,'v'))};
}
it('dormant retained funded transport cancellation keeps one original request, exact fee and invoice while only service work is removed',async()=>{
 const f=await retainedTransportReady(),request=(await db.collection('pickupRequests').doc('b_wash').get()).data(),invoice=(await db.collection('visitInvoices').get()).docs[0]!.data(),sibling=(await db.collection('jobs').doc('interior').get()).data();
 expect(f.review).toMatchObject({feePaise:0,transportRetainedPaise:3544,paidPaise:145144,retainedPaise:3544,returnPaise:141600,feeDuePaise:0});
 expect(await f.cancel()).toMatchObject({alreadyCancelled:false,retainedPaise:3544,returnReviewPaise:141600});
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(request);expect((await db.collection('visitInvoices').get()).docs[0]!.data()).toEqual(invoice);expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);
 expect((await db.collection('carVisits').doc('v').get()).data()!.transportJobId).toBe('wash');expect((await db.collection('visitTransportRetentions').get()).size).toBe(1);
 expect(await f.billing()).toMatchObject({returnReviews:[{jobId:'wash',retainedPaise:3544,returnPaise:141600,returnedPaise:0}],review:{totalPaise:240000,appliedPaise:240000,balancePaise:0}});
 expect(await f.cancel()).toMatchObject({alreadyCancelled:true});expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant explicit unused drop enters Admin original-method review without pretending completed pickup is unused or changing the request',async()=>{
 const f=await retainedTransportReady(['drop']);expect(f.review).toMatchObject({feePaise:0,transportRetainedPaise:1181,retainedPaise:1181,returnPaise:143963});await f.cancel();
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(f.request);expect((await f.billing()).returnReviews[0]).toMatchObject({retainedPaise:1181,returnPaise:143963,returnedPaise:0});
 const{progressRetainedVisitTransport}=await import('../../lib/visit-retained-transport-progress.js'),{randomUUID}=await import('node:crypto'),{visitReturnHash}=await import('../../lib/visit-service-return-state.js');
 await expect(progressRetainedVisitTransport(db,f.user,{visitId:'v',jobId:'wash',operationId:randomUUID(),requestToken:visitReturnHash(f.request),leg:'drop',completed:true})).rejects.toThrow();
});
it.each(['fee','anchor','request-copy','retention','original-stamp'])('dormant retained transport %s drift fails closed without moving or recreating physical transport',async kind=>{
 const f=await retainedTransportReady();await f.cancel();
 if(kind==='fee')await db.collection('pickupRequests').doc('b_wash').update({feePaise:3004});
 if(kind==='anchor')await db.collection('carVisits').doc('v').update({transportJobId:'interior'});
 if(kind==='request-copy'){await db.collection('pickupRequests').doc('b_wash').delete();await db.collection('pickupRequests').doc('b_interior').set({...f.request,id:'b_interior',bookingId:'b_interior',jobId:'interior'});}
 if(kind==='retention')await db.collection('visitTransportRetentions').doc('wash').update({retainedTransportPaise:1});
 if(kind==='original-stamp')await db.collection('pickupRequests').doc('b_wash').update({pickupCompletedAt:null});
 await expect(f.billing()).rejects.toThrow();expect((await db.collection('refundRequests').get()).empty).toBe(true);
});
it('dormant retained request progress cannot return the car before the surviving service full handover/payment/work checks',async()=>{
 const f=await retainedTransportReady();await f.cancel();const{progressRetainedVisitTransport}=await import('../../lib/visit-retained-transport-progress.js'),{randomUUID}=await import('node:crypto'),{visitReturnHash}=await import('../../lib/visit-service-return-state.js');
 await expect(progressRetainedVisitTransport(db,f.user,{visitId:'v',jobId:'wash',operationId:randomUUID(),requestToken:visitReturnHash(f.request),leg:'drop',completed:true})).rejects.toThrow('Finish every visit service');
 expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(f.request);
});
it('dormant retained original drop remains usable after its booking cancellation through actual surviving-service work and handover',async()=>{
 const f=await retainedTransportReady();await f.cancel();
 const{recordJobPerformedWork}=await import('../../functions/work/recordJobPerformedWork.js'),{startVisitHandover}=await import('../../functions/visit/startVisitHandover.js'),{completeVisitHandover}=await import('../../functions/visit/completeVisitHandover.js'),{visitWorkReview}=await import('../../lib/visit-work-review.js'),{randomUUID}=await import('node:crypto');
 await db.collection('jobs').doc('interior').update({status:'READY_FOR_DELIVERY',statusHistory:[],bayId:'',createdAt:new Date().toISOString(),scheduledAt:new Date().toISOString(),estimatedEndAt:new Date().toISOString(),estimatedEndDate:'2026-11-15',estimatedDurationMinutes:60,isWalkIn:false,assignedEmployeeId:null,sealedAt:null});
 for(const step of[{expectedRevision:0,action:'record',lineId:'booked-0',approvalId:null,performed:true,work:{kind:'service'}},{expectedRevision:1,action:'qc',lineId:'booked-0',checked:true},{expectedRevision:2,action:'seal',confirmed:true}])await recordJobPerformedWork.run(request({jobId:'interior',operationId:randomUUID(),...step}));
 const members=await Promise.all(['wash','interior'].map(async jobId=>({jobId,expectedUpdatedAt:(await db.collection('jobs').doc(jobId).get()).data()!.updatedAt,recordedWork:visitWorkReview((await db.collection('jobPerformedWork').doc(jobId).get()).data())})));
 const manifest:any=await startVisitHandover.run(request({visitId:'v',expectedRevision:2,operationId:randomUUID(),confirmed:true,members}));
 expect(await completeVisitHandover.run(request({manifestId:manifest.manifestId,confirmed:true}))).toMatchObject({status:'complete',error:null});
 const{progressRetainedVisitTransport}=await import('../../lib/visit-retained-transport-progress.js'),{visitReturnHash}=await import('../../lib/visit-service-return-state.js'),command={visitId:'v',jobId:'wash',operationId:randomUUID(),requestToken:visitReturnHash(f.request),leg:'drop',completed:true};
 expect(await progressRetainedVisitTransport(db,f.user,command)).toMatchObject({requestId:'b_wash',status:'DONE',alreadyCompleted:false});expect(await progressRetainedVisitTransport(db,f.user,command)).toMatchObject({alreadyCompleted:true});
 expect((await db.collection('pickupRequests').get()).size).toBe(1);expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toMatchObject({status:'DONE',feePaise:3003,pickupCompletedAt:f.request.pickupCompletedAt,dropCompletedAt:expect.any(String)});
 expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('CANCELLED');expect((await db.collection('jobs').doc('interior').get()).data()!.status).toBe('DELIVERED');
 expect(await f.billing()).toMatchObject({returnReviews:[{retainedPaise:3544,returnedPaise:0}],review:{balancePaise:0}});
});
it('dormant retained transport return approval and actual handover exclude the exact retained original trip amount',async()=>{
 const f=await retainedTransportReady();await f.cancel();const{approveVisitServiceReturn,recordVisitServiceManualReturn}=await import('../../lib/visit-service-manual-return.js');let p=(await f.billing()).returnReviews[0]!;
 await approveVisitServiceReturn(db,f.user,{visitId:'v',jobId:'wash',progressToken:p.progressToken,note:'Admin reviewed service-only return',approved:true});p=(await f.billing()).returnReviews[0]!;
 await recordVisitServiceManualReturn(db,f.user,{visitId:'v',jobId:'wash',entryKey:p.entries[0]!.key,progressToken:p.progressToken,note:'Actual service-only cash returned',returned:true});
 expect((await f.billing()).returnReviews[0]).toMatchObject({retainedPaise:3544,returnPaise:141600,returnedPaise:141600,status:'returned'});expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(f.request);
});
it('dormant transport cancellation does not invent a fee when a sibling continues or silently retain an unneeded future final leg',async()=>{
 const source=await transportReturnFixture();await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});
 const bill:any=await read(),prepared:any=await prepare(bill.reviewToken);await recordVisit(bill,prepared,{receivedPaise:145144});
 const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js'),transport=await source.read();await expect(db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now(),{reviewToken:transport.reviewToken,unusedLegs:[]}))).rejects.toThrow();
 const unused=await source.read(['drop']),review=await db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now(),{reviewToken:unused.reviewToken,unusedLegs:['drop']}));
 expect(review).toMatchObject({feePaise:10000,transportRetainedPaise:1181,retainedPaise:11181,returnPaise:133963,feeDuePaise:0});
});
it('dormant retained transport preparation cannot execute after the leg, quote or original fee changes',async()=>{
 const f=await retainedTransportReady();await db.collection('pickupRequests').doc('b_wash').update({dropCompletedAt:new Date().toISOString()});
 await expect(f.cancel()).rejects.toThrow();expect((await db.collection('jobs').doc('wash').get()).data()!.status).toBe('VEHICLE_RECEIVED');expect((await db.collection('visitTransportRetentions').get()).empty).toBe(true);
});
it('dormant partially funded transport stays held instead of moving its unpaid original fee to the sibling',async()=>{
 const source=await transportReturnFixture();await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});const bill:any=await read(),prepared:any=await prepare(bill.reviewToken);await recordVisit(bill,prepared,{receivedPaise:72000});
 const transport=await source.read(),{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js');
 await expect(db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','wash',Date.now(),{reviewToken:transport.reviewToken,unusedLegs:[]}))).rejects.toThrow();expect((await db.collection('visitServiceReturns').get()).empty).toBe(true);
});
it('dormant later final sibling removal cannot strand an unfinished trip retained by an earlier cancelled anchor',async()=>{
 const f=await retainedTransportReady();await f.cancel();const{readVisitServiceReturnReview}=await import('../../lib/visit-service-return-review.js');
 await expect(db.runTransaction(tx=>readVisitServiceReturnReview(tx,db,'v','interior',Date.now()))).rejects.toThrow();
 expect((await db.collection('jobs').doc('interior').get()).data()!.status).toBe('VEHICLE_RECEIVED');expect((await db.collection('pickupRequests').doc('b_wash').get()).data()).toEqual(f.request);
});

async function coveredCancelReady(){
 const covered=await coveredVisitFixture(),{cancelVisitCoveredService}=await import('../../lib/visit-covered-cancellation.js'),{readVisitBilling}=await import('../../lib/visit-billing.js'),{randomUUID}=await import('node:crypto');
 const current:any=await read(),user={uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}}as any,command={visitId:'v',jobId:'wash',operationId:randomUUID(),reviewToken:current.reviewToken,reason:'Covered service no longer needed',cancelled:true,restoreWash:true};
 return{...covered,user,command,cancel:()=>cancelVisitCoveredService(db,user,command),billing:()=>db.runTransaction(tx=>readVisitBilling(tx,db,'v')),api:cancelVisitCoveredService};
}
it('dormant covered zero cancellation restores exactly one proven wash without money or rewriting the issued original',async()=>{
 const f=await coveredCancelReady(),invoice=f.invoice,usage=(await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').get()).data(),sibling=(await db.collection('jobs').doc('interior').get()).data();
 expect(await f.cancel()).toMatchObject({alreadyCancelled:false,restoredWashes:1,returnedPaise:0,revision:2});expect(await f.cancel()).toMatchObject({alreadyCancelled:true});
 expect((await db.collection('memberships').doc('covered_plan').get()).data()).toMatchObject({washesUsed:0,status:'expired'});expect((await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').get()).data()).toEqual(usage);
 expect((await db.collection('invoices').doc(f.settlement.invoiceId).get()).data()).toEqual(invoice);expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);
 expect((await f.billing()).review).toMatchObject({totalPaise:240000,appliedPaise:0,balancePaise:240000,lines:expect.arrayContaining([expect.objectContaining({jobId:'wash',cancelled:true,invoiceId:f.settlement.invoiceId})])});
 for(const c of['refundRequests','payments','visitServiceReturns','visitServiceManualReturns'])expect((await db.collection(c).get()).empty).toBe(true);
});
it('dormant cancelled covered original remains visible while sibling receives its full real receipt and invoice',async()=>{
 const f=await coveredCancelReady();await f.cancel();await db.collection('jobs').doc('interior').update({status:'VEHICLE_RECEIVED'});
 const bill:any=await read(),prepared:any=await prepare(bill.reviewToken),receipt:any=await recordVisit(bill,prepared,{receivedPaise:240000});expect(receipt.entries).toEqual([{jobId:'interior',appliedPaise:240000}]);expect((await f.billing()).review.balancePaise).toBe(0);
 expect((await db.collection('memberships').doc('covered_plan').get()).data()!.washesUsed).toBe(0);expect((await db.collection('invoices').doc(f.settlement.invoiceId).get()).data()).toEqual(f.invoice);
});
it('dormant simultaneous covered cancellations share one restore marker and cannot decrement twice',async()=>{
 const f=await coveredCancelReady(),results=await Promise.all([f.cancel(),f.cancel()]);expect(results.map(r=>r.alreadyCancelled).sort()).toEqual([false,true]);expect((await db.collection('memberships').doc('covered_plan').get()).data()!.washesUsed).toBe(0);
 expect((await db.collection('visitCoveredCancellations').get()).size).toBe(1);expect((await db.collection('memberships').doc('covered_plan').collection('visitCancellationRestores').get()).size).toBe(1);
});
it.each(['usage-missing','usage-changed','counter-empty','transport','work-started','stale-token'])('dormant covered cancellation refuses %s before a restore or partial transition',async kind=>{
 const f=await coveredCancelReady();if(kind==='usage-missing')await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').delete();if(kind==='usage-changed')await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').update({valueRedeemed:1});
 if(kind==='counter-empty')await db.collection('memberships').doc('covered_plan').update({washesUsed:0});if(kind==='transport')await db.collection('pickupRequests').doc('b_wash').set({id:'b_wash',tenantId:'t',studioId:'s',customerId:'c',bookingId:'b_wash',status:'DECLINED'});if(kind==='work-started')await db.collection('jobs').doc('wash').update({status:'IN_PROGRESS'});if(kind==='stale-token')await db.collection('jobs').doc('interior').update({updatedAt:'changed'});
 await expect(f.cancel()).rejects.toThrow();expect((await db.collection('visitCoveredCancellations').get()).empty).toBe(true);expect((await db.collection('jobs').doc('wash').get()).data()!.status).not.toBe('CANCELLED');
});
it.each(['marker-missing','invoice-changed','usage-changed','booking-marker'])('dormant cancelled covered evidence %s never fabricates a paid sibling or revived benefit',async kind=>{
 const f=await coveredCancelReady();await f.cancel();if(kind==='marker-missing')await db.collection('memberships').doc('covered_plan').collection('visitCancellationRestores').doc('wash').delete();if(kind==='invoice-changed')await db.collection('invoices').doc(f.settlement.invoiceId).update({invoiceNumber:'CHANGED'});if(kind==='usage-changed')await db.collection('memberships').doc('covered_plan').collection('usage').doc('wash').update({valueRedeemed:1});if(kind==='booking-marker')await db.collection('bookings').doc('b_wash').update({membershipWashUsed:true});await expect(f.billing()).rejects.toThrow();
});
it('dormant covered cancellation is Admin-only, exact-confirmed and cannot reuse a restore for another reason',async()=>{
 const f=await coveredCancelReady();for(const role of['customer','studio','accountant'])await expect(f.api(db,{...f.user,claims:{...f.user.claims,role}},f.command)).rejects.toMatchObject({code:'permission-denied'});
 await expect(f.api(db,f.user,{...f.command,restoreWash:false})).rejects.toMatchObject({code:'invalid-argument'});await f.cancel();await expect(f.api(db,f.user,{...f.command,reason:'Different cancellation'})).rejects.toThrow();
});
it('dormant covered final-service cancellation cannot silently waive its existing late fixed fee',async()=>{
 const f=await coveredCancelReady();await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});const current:any=await read();
 await expect(f.api(db,f.user,{...f.command,reviewToken:current.reviewToken})).rejects.toThrow();expect((await db.collection('memberships').doc('covered_plan').get()).data()!.washesUsed).toBe(1);
});
it('dormant covered cancellation permits later legitimate membership usage without pretending its own restored wash was reconsumed',async()=>{
 const f=await coveredCancelReady();await f.cancel();await db.collection('memberships').doc('covered_plan').update({washesUsed:1,status:'active'});expect((await f.billing()).review.balancePaise).toBe(240000);
});

async function giftCancelReady(patch:any={}){
 const pb={vehicleCategory:'hatchback',basePrice:0,scopeAdjustment:0,addOns:[],subtotal:0,membershipDiscount:0,membershipDiscountPercent:null,pickupFee:0,dropFee:0,taxRatePercent:0,taxDescription:'No tax',tax:0,total:0,currency:'INR'};
 await db.collection('jobs').doc('wash').update({totalAmount:0,priceBreakdown:pb});await db.collection('bookings').doc('b_wash').update({totalAmount:0,priceBreakdown:pb,giftId:'gift_wash'});
 const gift={id:'gift_wash',tenantId:'t',buyerId:'buyer',serviceId:'wash',amountPaise:120000,status:'REDEEMED',claimedBy:'c',redeemedBy:'c',bookingId:'b_wash',paymentId:'gift_payment',purchasedAt:'2026-09-01T00:00:00.000Z',expiresAt:'2026-10-31T00:00:00.000Z',redeemedAt:'2026-10-01T00:00:00.000Z',refundRequested:false,...patch};
 await db.collection('gifts').doc('gift_wash').set(gift);await db.collection('payments').doc('gift_payment').set({id:'gift_payment',tenantId:'t',studioId:null,customerId:'buyer',giftId:'gift_wash',targetType:'gift',bookingId:null,jobId:null,method:'razorpay_payment_link',razorpayPaymentId:'pay_gift',amount:120000,currency:'INR',status:patch.status==='REFUNDED'?'refunded':'completed',...(patch.status==='REFUNDED'?{refundAmount:120000}:{})});
 const{readVisitGiftCancellationReview,cancelVisitGiftService}=await import('../../lib/visit-gift-cancellation.js'),{randomUUID}=await import('node:crypto');
 const review=await db.runTransaction(tx=>readVisitGiftCancellationReview(tx,db,'v','wash')),user={uid:'staff',claims:{role:'admin',tenantId:'t',studioId:'s'}}as any;
 const command={visitId:'v',jobId:'wash',operationId:randomUUID(),reviewToken:review.reviewToken,reason:'Gifted work no longer needed',cancelled:true,reviewedGift:true};
 return{gift,review,user,command,read:()=>db.runTransaction(tx=>readVisitGiftCancellationReview(tx,db,'v','wash')),api:cancelVisitGiftService,cancel:()=>cancelVisitGiftService(db,user,command)};
}
it('dormant gift cancellation restores only the original gift identity without extending expiry, buyer refund or recipient money',async()=>{
 const f=await giftCancelReady(),payment=(await db.collection('payments').doc('gift_payment').get()).data(),sibling=(await db.collection('jobs').doc('interior').get()).data();expect(f.review.decision).toBe('restore_original_gift');
 expect(await f.cancel()).toMatchObject({restoredGift:true,returnedPaise:0,alreadyCancelled:false});expect(await f.cancel()).toMatchObject({alreadyCancelled:true});
 expect((await db.collection('gifts').doc('gift_wash').get()).data()).toEqual({...f.gift,status:'ACTIVE',redeemedBy:null,redeemedAt:null,bookingId:null});
 expect((await db.collection('payments').doc('gift_payment').get()).data()).toEqual(payment);expect((await db.collection('jobs').doc('interior').get()).data()).toEqual(sibling);expect(await read()).toMatchObject({balancePaise:240000});
 expect((await db.collection('payments').get()).size).toBe(1);expect((await db.collection('refundRequests').get()).empty).toBe(true);expect((await db.collection('visitGiftCancellations').get()).size).toBe(1);
});
it.each(['REFUNDED','VOID'])('dormant %s gift stays dead, never revived by cancelling its old service',async status=>{
 const f=await giftCancelReady({status});if(status==='REFUNDED'){await db.collection('payments').doc('gift_payment').update({status:'refunded',refundAmount:120000});}
 const review=await f.read();expect(await f.api(db,f.user,{...f.command,reviewToken:review.reviewToken})).toMatchObject({restoredGift:false,returnedPaise:0});expect((await db.collection('gifts').doc('gift_wash').get()).data()!.status).toBe(status);
});
it('dormant changed gift payment refund evidence invalidates the old review and fresh cancellation keeps credit refunded',async()=>{
 const f=await giftCancelReady();await db.collection('payments').doc('gift_payment').update({status:'refunded',refundAmount:120000,refundedAt:new Date().toISOString()});await expect(f.cancel()).rejects.toThrow();
 const review=await f.read();expect(review.decision).toBe('keep_refunded');expect(await f.api(db,f.user,{...f.command,reviewToken:review.reviewToken})).toMatchObject({restoredGift:false});expect((await db.collection('gifts').doc('gift_wash').get()).data()!.status).toBe('REFUNDED');
});
it.each(['pending-refund','legacy-claim','wrong-buyer','wrong-amount','duplicate-payment','hidden-pickup','source-missing'])('dormant gift cancellation %s needs review before any revival',async kind=>{
 const f=await giftCancelReady();if(kind==='pending-refund')await db.collection('refundRequests').doc('r').set({paymentId:'gift_payment',status:'submitting'});if(kind==='legacy-claim')await db.collection('paymentEvents').doc('refund_gift_payment').set({kind:'external_return_hold'});if(kind==='wrong-buyer')await db.collection('payments').doc('gift_payment').update({customerId:'other'});if(kind==='wrong-amount')await db.collection('payments').doc('gift_payment').update({amount:119999});if(kind==='duplicate-payment')await db.collection('payments').doc('duplicate').set({giftId:'gift_wash'});if(kind==='hidden-pickup')await db.collection('pickupRequests').doc('b_wash').set({tenantId:'t',customerId:'c',bookingId:'b_wash',status:'DECLINED'});if(kind==='source-missing')await db.collection('payments').doc('gift_payment').delete();
 await expect(f.cancel()).rejects.toThrow();expect((await db.collection('gifts').doc('gift_wash').get()).data()!.status).toBe('REDEEMED');expect((await db.collection('visitGiftCancellations').get()).empty).toBe(true);
});
it('dormant gift restore exact concurrent retry cannot create a second credit and does not follow a later new redemption',async()=>{
 const f=await giftCancelReady(),results=await Promise.all([f.cancel(),f.cancel()]);expect(results.map(r=>r.alreadyCancelled).sort()).toEqual([false,true]);
 await db.collection('gifts').doc('gift_wash').update({status:'REDEEMED',bookingId:'later_booking',redeemedBy:'c',redeemedAt:new Date().toISOString()});expect(await f.cancel()).toMatchObject({alreadyCancelled:true});expect((await db.collection('gifts').doc('gift_wash').get()).data()!.bookingId).toBe('later_booking');
});
it('dormant gift cancellation requires Admin, exact confirmation and existing final-service fee review',async()=>{
 const f=await giftCancelReady();for(const role of['studio','customer','accountant'])await expect(f.api(db,{...f.user,claims:{...f.user.claims,role}},f.command)).rejects.toMatchObject({code:'permission-denied'});await expect(f.api(db,f.user,{...f.command,reviewedGift:false})).rejects.toMatchObject({code:'invalid-argument'});
 await db.collection('jobs').doc('interior').update({status:'CANCELLED'});await db.collection('bookings').doc('b_interior').update({status:'CANCELLED'});await expect(f.read()).rejects.toThrow();expect((await db.collection('gifts').doc('gift_wash').get()).data()!.status).toBe('REDEEMED');
});

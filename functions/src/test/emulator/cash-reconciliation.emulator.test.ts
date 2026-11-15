import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {holdCashReconciliation,runCashReconciliation} from '../../lib/cash-reconciliation.js';
import {processProviderEvent} from '../../lib/razorpay-webhook.js';
import {calculatePrice} from '../../lib/pricing.js';
const projectId=process.env.GCLOUD_PROJECT??'demo-autodeck-cash';
const app=initializeApp({projectId},'cash-isolated');
const db=getFirestore(app);
const user={uid:'office',claims:{role:'admin',tenantId:'cash_t',studioId:null}} as any;
const pb=calculatePrice({serviceCategory:'ppf',basePrice:250000,vehicleCategory:'hatchback',vehicleCategoryPricing:[]});
const amount=pb.total;
const fact={jobId:'cash_j',paymentId:'cash_p',receiptKey:'cashreceipt_emulator',receivedPaise:amount,receivedAt:'2026-11-13T16:30:00Z',collectedBy:'Counter staff',reason:'Cash recorded in emulator'};
const link=()=>({providerPaymentLinkId:'plink_cash',providerOrderId:null,paymentUrl:'https://example.invalid',status:'cancelled',amount,currency:'INR',evidence:{referenceId:'cash_p',amountPaid:0,payments:[]}});
const provider=()=>({name:'mock',fetchPaymentLink:async()=>link(),cancelPaymentLink:async()=>{throw Error('must not cancel inactive')}} as any);
let rules:RulesTestEnvironment;
beforeAll(async()=>{if(!projectId.startsWith('demo-')||!process.env.FIRESTORE_EMULATOR_HOST||! /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST))throw Error('Local emulator required, no production fallback');
 rules=await initializeTestEnvironment({projectId,firestore:{host:process.env.FIRESTORE_EMULATOR_HOST!.split(':')[0]!,port:Number(process.env.FIRESTORE_EMULATOR_HOST!.split(':')[1]),rules:readFileSync('../firestore.rules','utf8')}});
});
beforeEach(async()=>{
 for(const c of ['jobs','payments','customers','services','vehicles','cashReconciliations','cashReconciliationAttempts','offlineReceipts','offlineReturnObligations','invoices','invoiceCounters','auditLog','paymentEvents']){
  const rows=await db.collection(c).get();for(const d of rows.docs)await d.ref.delete();
 }
 await db.doc('customers/cash_c').set({tenantId:'cash_t',name:'Cash test'});
 await db.doc('services/cash_svc').set({tenantId:'cash_t',name:'Detail SPA',category:'detailing'});
 await db.doc('vehicles/cash_v').set({tenantId:'cash_t',ownerId:'cash_c',registrationNumber:'TEST0001',make:'Kia',model:'Seltos',year:2023,color:'White'});
 await db.doc('jobs/cash_j').set({id:'cash_j',tenantId:'cash_t',studioId:'cash_studio',customerId:'cash_c',bookingId:null,vehicleId:'cash_v',serviceId:'cash_svc',status:'READY_FOR_DELIVERY',totalAmount:amount,paymentStatus:'unpaid',priceBreakdown:pb,additionalWorkDelta:0});
 await db.doc('payments/cash_p').set({id:'cash_p',jobId:'cash_j',targetType:'job',tenantId:'cash_t',studioId:'cash_studio',customerId:'cash_c',amount,currency:'INR',status:'pending',method:'razorpay_payment_link',razorpayPaymentLinkId:'plink_cash'});
});
afterAll(async()=>{await rules.cleanup();await deleteApp(app)});
it('real Firestore transaction settles one invoice/counter and exact retry without provider effect',async()=>{
 await holdCashReconciliation(db,user,fact);await runCashReconciliation(db,user,fact.receiptKey,provider());
 expect((await db.doc('jobs/cash_j').get()).data()).toMatchObject({status:'READY_FOR_DELIVERY',paymentStatus:'paid'});
 expect((await db.collection('invoices').get()).size).toBe(1);expect((await db.collection('offlineReceipts').get()).size).toBe(1);
 const p=provider();p.fetchPaymentLink=async()=>{throw Error('retry must not fetch')};
 expect(await runCashReconciliation(db,user,fact.receiptKey,p)).toMatchObject({state:'settled',alreadyRecorded:true});
 expect((await db.collection('invoices').get()).size).toBe(1);
});
it('concurrent runners serialize to one invoice/receipt and retain cash fact',async()=>{
 await holdCashReconciliation(db,user,fact);
 await Promise.all([runCashReconciliation(db,user,fact.receiptKey,provider()),runCashReconciliation(db,user,fact.receiptKey,provider())]);
 expect((await db.collection('invoices').get()).size).toBe(1);expect((await db.collection('offlineReceipts').get()).size).toBe(1);
 expect((await db.doc('cashReconciliations/'+fact.receiptKey).get()).data()).toMatchObject({receivedPaise:amount,state:'settled'});
});
it('capture racing with cash allocation is recorded and reviewed, with no second invoice or refund',async()=>{
 await holdCashReconciliation(db,user,fact);
 const event:any={eventType:'payment_link.paid',providerEventId:'evt_cash_emulator',providerPaymentId:'pay_cash_online',providerPaymentLinkId:'plink_cash',providerRefundId:null,referenceId:'cash_p',amount,currency:'INR'};
 const results=await Promise.allSettled([runCashReconciliation(db,user,fact.receiptKey,provider()),processProviderEvent(db,event)]);
 expect(results[1].status).toBe('fulfilled');
 expect((await db.doc('payments/cash_p').get()).data()).toMatchObject({status:'completed',invoiceReviewNeeded:true});
 expect((await db.collection('invoices').get()).size).toBeLessThanOrEqual(1);
 expect((await db.doc('cashReconciliations/'+fact.receiptKey).get()).data()?.receivedPaise).toBe(amount);
});

it('existing rules deny clients direct cash fact reads, writes and attempt tampering',async()=>{
 const client=rules.authenticatedContext('office',{role:'admin',tenantId:'cash_t'}).firestore();
 await assertFails(getDoc(doc(client,'cashReconciliations/cashreceipt_emulator')));
 await assertFails(setDoc(doc(client,'cashReconciliations/cashreceipt_emulator'),{receivedPaise:1}));
 await assertFails(setDoc(doc(client,'cashReconciliationAttempts/forged'),{outcome:'ready'}));
});

it('ambiguous cancel persists held fact and restart reconciles without a second provider cancellation',async()=>{
 await holdCashReconciliation(db,user,fact);
 const p=provider();p.fetchPaymentLink=async()=>({...link(),status:'created'});p.cancelPaymentLink=async()=>{throw Error('response lost after provider cancellation')};
 expect(await runCashReconciliation(db,user,fact.receiptKey,p)).toMatchObject({state:'review'});
 expect((await db.collection('offlineReceipts').get()).size).toBe(0);
 await runCashReconciliation(db,user,fact.receiptKey,provider());
 expect((await db.collection('offlineReceipts').get()).size).toBe(1);
 expect((await db.collection('invoices').get()).size).toBe(1);
});
it('changed consult guard after provider closes leaves financial projections untouched',async()=>{
 await holdCashReconciliation(db,user,fact);await db.doc('services/cash_svc').update({priceOnRequest:true});
 await expect(runCashReconciliation(db,user,fact.receiptKey,provider())).rejects.toBeTruthy();
 expect((await db.collection('offlineReceipts').get()).size).toBe(0);expect((await db.collection('invoices').get()).size).toBe(0);
 expect((await db.doc('payments/cash_p').get()).data()?.status).toBe('pending');
 expect((await db.doc('cashReconciliations/'+fact.receiptKey).get()).data()?.receivedPaise).toBe(amount);
});

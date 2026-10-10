import {describe,it,expect,beforeAll,afterAll,beforeEach} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {getFirestore} from 'firebase-admin/firestore';
import {permanentlyDeleteVehicle} from '../../lib/vehicle-delete.js';
let env:RulesTestEnvironment;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'autodeck-dev',firestore:{rules:readFileSync(resolve(__dirname,'../../../../firestore.rules'),'utf8'),host:'localhost',port:Number(process.env["FIRESTORE_EMULATOR_HOST"]?.split(":").at(-1)??8080)}});});
afterAll(async()=>{await env.cleanup();});beforeEach(async()=>{await env.clearFirestore();});
describe('Round 2 retained history on real Firestore emulator',()=>{
 it('delete keeps exact jobs/invoice amounts and owner-readable tombstone, denies other owner/tenant and client writes',async()=>{
 const db=getFirestore();const car={id:'r2-car',tenantId:'t',ownerId:'owner',registrationNumber:'GJ01AB1234',make:'Tata',model:'Nexon',year:2022,color:'White',photoUrl:null,deletedAt:'2026-10-01'};
 await db.collection('vehicles').doc(car.id).set(car);
 await db.collection('bookings').doc('r2-booking').set({tenantId:'t',customerId:'owner',vehicleId:car.id,status:'COMPLETED'});
 await db.collection('jobs').doc('r2-job').set({tenantId:'t',customerId:'owner',vehicleId:car.id,status:'DELIVERED'});
 await db.collection('invoices').doc('r2-invoice').set({tenantId:'t',customerId:'owner',vehicleId:car.id,jobId:'r2-job',total:118000,lineItems:[{description:'Wash',total:100000}]});
 await permanentlyDeleteVehicle(db,{uid:'owner',role:'customer',tenantId:'t'},car.id,()=>{});
 expect((await db.collection('vehicles').doc(car.id).get()).exists).toBe(false);
 const owner=env.authenticatedContext('owner',{role:'customer',tenantId:'t'}).firestore();
 await assertSucceeds(owner.collection('deletedVehicles').doc(car.id).get());
 await assertSucceeds(owner.collection('jobs').doc('r2-job').get());
 const inv=await assertSucceeds(owner.collection('invoices').doc('r2-invoice').get());expect(inv.data()?.total).toBe(118000);expect(inv.data()?.vehicleSnapshot.registrationNumber).toBe(car.registrationNumber);
 await assertFails(owner.collection('deletedVehicles').doc(car.id).delete());
 await assertFails(env.authenticatedContext('stranger',{role:'customer',tenantId:'t'}).firestore().collection('deletedVehicles').doc(car.id).get());
 await assertFails(env.authenticatedContext('owner',{role:'customer',tenantId:'other'}).firestore().collection('deletedVehicles').doc(car.id).get());
 const retry=await permanentlyDeleteVehicle(db,{uid:'owner',role:'customer',tenantId:'t'},car.id,()=>{});expect(retry.alreadyDeleted).toBe(true);
 });
});

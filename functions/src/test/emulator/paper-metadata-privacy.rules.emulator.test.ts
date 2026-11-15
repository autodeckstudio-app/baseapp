import {describe,it,expect,beforeAll,afterAll,beforeEach} from 'vitest';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {getFirestore} from 'firebase-admin/firestore';
import {collection,query,where,getDocs} from 'firebase/firestore';
import {TEST_PROJECT_ID} from '../emulator-setup';
const db=getFirestore(),T='paper-private-tenant',V='paper-private-car';let env:RulesTestEnvironment;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:TEST_PROJECT_ID,firestore:{rules:readFileSync(resolve(__dirname,'../../../../firestore.rules'),'utf8'),host:'127.0.0.1',port:Number(process.env.FIRESTORE_EMULATOR_TEST_PORT)}})});
afterAll(async()=>env.cleanup());
beforeEach(async()=>{await env.clearFirestore();for(const id of ['original','buyer','other'])await db.collection('customers').doc(id).set({authUid:id,tenantId:T,deletedAt:null});await db.collection('vehicles').doc(V).set({ownerId:'original',tenantId:T});await db.collection('papers').doc('p1').set({tenantId:T,studioId:'s1',customerId:'original',vehicleId:V});});
const as=(id:string,role='customer',tenantId=T,studioId='s1')=>env.authenticatedContext(id,{role,tenantId,studioId}).firestore();
const list=(id:string,cid=id,vid=V)=>getDocs(query(collection(as(id),'papers'),where('tenantId','==',T),where('customerId','==',cid),where('vehicleId','==',vid)));
describe('private paper metadata, exact listener-shaped rules',()=>{
 it('current owner reads their document, including legacy car with missing deletedAt',async()=>{expect((await assertSucceeds(getDocs(query(collection(as('original'),'vehicles'),where('tenantId','==',T),where('ownerId','==','original'))))).size).toBe(1);expect((await assertSucceeds(list('original'))).size).toBe(1)});
 it('former owner loses access and new owner inherits no private document',async()=>{await db.collection('vehicles').doc(V).update({ownerId:'buyer'});await assertFails(list('original'));expect((await assertSucceeds(list('buyer'))).size).toBe(0);await assertFails(list('buyer','original'));});
 it('archived or cross-tenant car does not grant reads',async()=>{await db.collection('vehicles').doc(V).update({deletedAt:'2026-11-09'});await assertFails(list('original'));await db.collection('vehicles').doc(V).set({ownerId:'original',tenantId:'other'});await assertFails(list('original'));});
 it('wide customer-only query fails closed: it cannot include transferred vehicles',async()=>{await assertFails(getDocs(query(collection(as('original'),'papers'),where('tenantId','==',T),where('customerId','==','original'))));});
 it('studio lists only own studio, admin keeps same-tenant list, cross tenant denied',async()=>{
 const listStaff=(role:string,tenant=T,studio='s1',scoped=true)=>getDocs(query(collection(as('office',role,tenant,studio),'papers'),where('tenantId','==',T),...(scoped?[where('studioId','==',studio)]:[])));
 expect((await assertSucceeds(listStaff('studio'))).size).toBe(1);expect((await assertSucceeds(listStaff('studio',T,'s2'))).size).toBe(0);await assertFails(listStaff('studio',T,'s1',false));expect((await assertSucceeds(listStaff('admin',T,'s1',false))).size).toBe(1);await assertFails(listStaff('admin','other','s1',false));
 });
});

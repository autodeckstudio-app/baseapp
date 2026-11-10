import{beforeAll,beforeEach,afterAll,describe,it,expect,vi}from'vitest';import{getFirestore}from'firebase-admin/firestore';import{initializeTestEnvironment,assertFails,type RulesTestEnvironment}from'@firebase/rules-unit-testing';import{getDoc,doc,setDoc}from'firebase/firestore';import{readFileSync}from'node:fs';import{resolve}from'node:path';import{submitMyListing,getMyListingSubmission}from'../../functions/carsale/carsale.js';import{TEST_PROJECT_ID}from'../emulator-setup';
const transport=vi.hoisted(()=>({failAck:false,uid:'login-uid',calls:[]as any[]}));
vi.mock('../../../../apps/customer/src/lib/firebase',()=>({functions:{},auth:{authStateReady:async()=>{},currentUser:{uid:'login-uid'}}}));
vi.mock('expo/fetch',()=>({fetch:globalThis.fetch}));
const runClientTransport=async(name:string,options:any,data:any)=>{
 transport.calls.push({name,data,options});const request={data,auth:{uid:transport.uid,token:{role:'customer',tenantId:'retry-tenant'}}}as any;
 const result=name==='submitMyListing'?await submitMyListing.run(request):name==='getMyListingSubmission'?await getMyListingSubmission.run(request):(()=>{throw Error('Unexpected callable')})();
 if(transport.failAck&&name==='submitMyListing'){transport.failAck=false;throw Error('simulated lost acknowledgement AFTER real commit')};return{data:result};
};

const db=getFirestore();let env:RulesTestEnvironment;const tenant='retry-tenant',cid='customer-doc',uid='login-uid';
const payload={operationId:'op-retry-key-12345',make:'Sample',model:'Car',year:2021,kmDriven:10000,fuel:'petrol',gearbox:'manual',owners:1,colour:'Blue',area:'Sample',askingPrice:1000000,photoPaths:[tenant+'/listings/fixture.jpg'],sellerName:'Sample',sellerPhone:'9999999999'};
const req=(data:any=payload,identity=uid,role='customer')=>({data,auth:{uid:identity,token:{role,tenantId:tenant}}}as any);
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:TEST_PROJECT_ID,firestore:{host:'127.0.0.1',port:8129,rules:readFileSync(resolve(__dirname,'../../../../firestore.rules'),'utf8')}})});afterAll(async()=>{await env.cleanup()});
beforeEach(async()=>{(globalThis as any).__carsClientTransport=runClientTransport;transport.failAck=false;transport.uid='login-uid';transport.calls=[];await env.clearFirestore();await db.collection('customers').doc(cid).set({id:cid,authUid:uid,tenantId:tenant,deletedAt:null})});
it('actual client adapter keeps the exact operation through lost ack, receipt check and retry against real Firestore',async()=>{
 const clientPath='../../../../apps/customer/src/lib/carsale-service';const {submitMyListing:clientSubmit,getMyListingSubmission:clientReadback}=await import(clientPath);
 const input={...payload,variant:null,bodyType:null,description:null,insuranceValidTill:null,registrationNumber:null}as any;
 transport.failAck=true;await expect(clientSubmit(input)).rejects.toThrow('lost acknowledgement');
 const first=(await db.collection('carListings').get()).docs[0]!;await first.ref.update({status:'sold'});
 expect(await clientReadback(input.operationId)).toEqual({status:'committed',id:first.id,listingStatus:'sold'});
 expect(await clientSubmit(input)).toBe(first.id);expect((await db.collection('carListings').get()).size).toBe(1);
 expect((await first.ref.get()).data()!['status']).toBe('sold');expect((await db.collection('auditLog').where('action','==','carListing.submitted').get()).size).toBe(1);
 expect(transport.calls.map(c=>[c.name,c.options.timeout])).toEqual([['submitMyListing',30000],['getMyListingSubmission',15000],['submitMyListing',30000]]);
 expect(transport.calls[0].data).toBe(input);expect(transport.calls[2].data).toBe(input);
 transport.uid='other';await db.collection('customers').doc('other').set({id:'other',authUid:'other',tenantId:tenant,deletedAt:null});expect(await clientReadback(input.operationId)).toEqual({status:'not_found'});
});

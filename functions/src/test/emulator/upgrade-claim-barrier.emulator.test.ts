import {it,expect,vi,beforeAll} from "vitest";
import {getFirestore} from "firebase-admin/firestore";
process.env["USE_PAYMENT_MOCK"]="true";
vi.mock("../../middleware/rateLimit.js",()=>({enforceRateLimit:async()=>{},subjectFrom:()=>"test"}));
import {upgradeMembership} from "../../functions/membership/upgradeMembership.js";
import {getPaymentProvider} from "../../lib/razorpay-provider.js";
const db=getFirestore();
beforeAll(()=>{if(!process.env["GCLOUD_PROJECT"]?.startsWith("demo-"))throw Error("demo emulator only");});
it("precommit barrier: two first upgrades cannot commit two pending memberships or links",async()=>{
 const uid=`upgrade-precommit-${Date.now()}`,old=`${uid}-old`,target=`${uid}-new`,active=`${uid}-active`;
 await db.collection("customers").doc(uid).set({id:uid,authUid:uid,tenantId:"claim-barrier",deletedAt:null});
 for(const [id,price] of [[old,90000],[target,180000]] as const)await db.collection("membershipPlans").doc(id).set({id,tenantId:"claim-barrier",active:true,tier:"gold",name:id,priceInPaise:price,includedWashes:3,discountPercent:10,freePickups:0,prioritySlot:false});
 await db.collection("memberships").doc(active).set({id:active,tenantId:"claim-barrier",customerId:uid,planId:old,status:"active",tier:"silver",washesUsed:0,washesTotal:3,pickupsUsed:0});
 // Exercise the already-active claim too: it is legitimate, but must be READ.
 await db.collection("membershipClaims").doc(`claim-barrier_${uid}`).set({membershipId:active});
 const original=db.runTransaction.bind(db);let started=0;let begin!:()=>void;const startBoth=new Promise<void>(r=>{begin=r;});let arrived=0;let release!:()=>void;const both=new Promise<void>(r=>{release=r;});
 const txSpy=vi.spyOn(db,"runTransaction").mockImplementation((async(fn: (tx:FirebaseFirestore.Transaction)=>Promise<unknown>,options?:FirebaseFirestore.ReadWriteTransactionOptions)=>{if(++started<=2){if(started===2)begin();await startBoth;}return original(async tx=>{
   const result=await fn(tx);
   // Pause transaction callback after ALL reads+writes, BEFORE SDK commit.
   // First two callbacks only. With claim READ, Firestore may serialize reads;
   // bounded timeout permits first commit, then second retries and fails closed.
   if(++arrived<=2){if(arrived===2)release();await Promise.race([both,new Promise<void>(r=>setTimeout(r,2500))]);}
   return result;
 },options);}) as typeof db.runTransaction);
 const api=getPaymentProvider(),paySpy=vi.spyOn(api,"createPaymentLink");
 try{
 const results=await Promise.allSettled([0,1].map(n=>upgradeMembership.run({data:{planId:target,method:"razorpay_payment_link",idempotencyKey:`upgrade-${n}`},auth:{uid,token:{role:"customer",tenantId:"claim-barrier",studioId:null}}} as never)));
 const memberships=await db.collection("memberships").where("customerId","==",uid).where("status","==","pending").get(),payments=await db.collection("payments").where("customerId","==",uid).get();
 console.warn("PRECOMMIT_RESULT",{memberships:memberships.size,payments:payments.size,links:paySpy.mock.calls.length,results:results.map(r=>r.status)});
 expect(memberships.size).toBe(1);expect(payments.size).toBe(1);expect(paySpy).toHaveBeenCalledTimes(1);
 }finally{txSpy.mockRestore();paySpy.mockRestore();}
},90000);

// Deploy-time gate for waiting-cancel intent CREATION (reconstructed).
//
// The gate ships OFF. Without it, a backend deploy of this source would let
// cancellation create bookingCancelIntents that no shipped surface displays:
// stranded intents holding slots. While OFF:
//   - no customer/admin request or preview can create or claim an intent;
//   - an intent that ALREADY exists (created while the gate was on, or seeded)
//     still resolves through the webhook and stays idempotent on repeat;
//   - nothing about bookings/payments/audit changes on a refused request.
import { describe, it, expect, afterEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { adminCancelBooking } from "../../functions/booking/adminCancelBooking.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import type { ProviderWebhookEvent } from "../../lib/payment-provider.js";
import { WAITING_CANCEL_GATE } from "../../lib/waiting-cancel.js";
const db = getFirestore(); let n=0;
const auth = (uid:string, role="customer",tenant="wcg") => ({uid,token:{role,tenantId:tenant,studioId:null},rawToken:"test"});
async function seed(status="pending") {
 const id=`wcg-${Date.now()}-${++n}`, now=new Date().toISOString(), customerId=`c-${id}`;
 await db.collection("bookings").doc(id).set({id,tenantId:"wcg",studioId:"s",customerId,serviceId:"svc",status:"PENDING",paymentStatus:"unpaid",totalAmount:100000,scheduledAt:new Date(Date.now()+3600000).toISOString(),holdExpiresAt:new Date(Date.now()-60000).toISOString(),createdAt:now,updatedAt:now});
 await db.collection("jobs").doc(id).set({id,tenantId:"wcg",studioId:"s",customerId,bookingId:id,status:"PENDING_VEHICLE",paymentStatus:"unpaid",statusHistory:[]});
 await db.collection("payments").doc(id).set({id,tenantId:"wcg",studioId:"s",customerId,bookingId:id,jobId:id,status,method:"razorpay_payment_link",amount:100000,currency:"INR",razorpayPaymentLinkId:`link-${id}`,razorpayPaymentId:`pay-${id}`,refundAmount:0});
 return {id,customerId};
}
const doc=async(c:string,id:string)=>(await db.collection(c).doc(id).get()).data()!;
const event=(id:string,type="payment_link.paid")=>({eventType:type,providerEventId:`ev-${id}-${++n}`,providerPaymentLinkId:`link-${id}`,providerPaymentId:`pay-${id}`,providerOrderId:null,referenceId:id,amount:100000,currency:"INR"}) as ProviderWebhookEvent;

afterEach(()=>{WAITING_CANCEL_GATE.enabled=false});

describe("waiting-cancel deploy gate (ships OFF)",()=>{
 it("source guard: the shipped default is OFF",()=>{
   const src=readFileSync("src/lib/waiting-cancel.ts","utf8");
   expect(src).toContain("export const WAITING_CANCEL_GATE = { enabled: false };");
   expect(WAITING_CANCEL_GATE.enabled).toBe(false);
 });
 it("OFF: customer and admin requests refuse and create NOTHING",async()=>{
   for(const admin of [false,true]){
     const s=await seed();
     const run= admin
       ? adminCancelBooking.run({data:{bookingId:s.id,reason:"wait",feeAction:"charge"},auth:auth("admin","admin")} as never)
       : cancelBooking.run({data:{bookingId:s.id,reason:"wait",customerContext:true},auth:auth(s.customerId)} as never);
     await expect(run).rejects.toMatchObject({code:"failed-precondition"});
     expect((await db.collection("bookingCancelIntents").doc(s.id).get()).exists).toBe(false);
     const b=await doc("bookings",s.id);
     expect(b.status).toBe("PENDING");
     expect(b.cancelIntent).toBeUndefined();
     expect((await doc("payments",s.id)).status).toBe("pending");
     expect((await db.collection("auditLog").where("entityId","==",s.id).get()).empty).toBe(true);
   }
 });
 it("OFF: admin preview cannot claim a pending cancellation either",async()=>{
   const s=await seed();
   await expect(adminCancelBooking.run({data:{bookingId:s.id,reason:"wait",feeAction:"charge",preview:true},auth:auth("admin","admin")} as never)).rejects.toMatchObject({code:"failed-precondition"});
   expect((await db.collection("bookingCancelIntents").doc(s.id).get()).exists).toBe(false);
 });
 it("OFF: a pre-existing intent still resolves via webhook and repeat stays idempotent",async()=>{
   const s=await seed(), now=new Date().toISOString();
   // Seed as if created while the gate was on.
   await db.collection("bookingCancelIntents").doc(s.id).set({bookingId:s.id,tenantId:"wcg",studioId:"s",customerId:s.customerId,jobId:s.id,paymentId:s.id,state:"waiting",requestedAt:now,requestedBy:"admin",reason:"wait",reviewAt:new Date(Date.now()+900000).toISOString()});
   await db.collection("bookings").doc(s.id).update({cancelIntent:{state:"waiting",requestedAt:now}});
   // Repeat request is idempotent even with the gate OFF.
   const r=await adminCancelBooking.run({data:{bookingId:s.id,reason:"again",feeAction:"charge"},auth:auth("admin","admin")} as never) as {success?:boolean;cancellationPending?:boolean};
   expect(r.success).toBe(true); expect(r.cancellationPending).toBe(true);
   // Webhook resolution is NOT gated: capture resolves the intent and reserves the refund.
   await processProviderEvent(db,event(s.id));
   const i=await doc("bookingCancelIntents",s.id);
   expect(i.state).toBe("resolved");
   expect(i.resolution).toBe("captured_refund_reserved");
   expect((await doc("bookings",s.id)).status).toBe("CANCELLED");
 });
 it("ON then OFF: intents created while ON persist, but nothing new is created after flip",async()=>{
   WAITING_CANCEL_GATE.enabled=true;
   const s=await seed();
   await adminCancelBooking.run({data:{bookingId:s.id,reason:"wait",feeAction:"charge"},auth:auth("admin","admin")} as never);
   expect((await db.collection("bookingCancelIntents").doc(s.id).get()).exists).toBe(true);
   WAITING_CANCEL_GATE.enabled=false;
   const s2=await seed();
   await expect(adminCancelBooking.run({data:{bookingId:s2.id,reason:"wait",feeAction:"charge"},auth:auth("admin","admin")} as never)).rejects.toMatchObject({code:"failed-precondition"});
   expect((await db.collection("bookingCancelIntents").doc(s2.id).get()).exists).toBe(false);
 });
});

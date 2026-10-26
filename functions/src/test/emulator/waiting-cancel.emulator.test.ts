import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { adminCancelBooking } from "../../functions/booking/adminCancelBooking.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { sweepExpiredBookingHolds } from "../../lib/booking-hold.js";
import { flagMissedBookings } from "../../lib/missed-bookings.js";
import type { ProviderWebhookEvent } from "../../lib/payment-provider.js";
import { resolveWaitingCancel } from "../../lib/waiting-cancel.js";
const db = getFirestore(); let n=0;
const auth = (uid:string, role="customer",tenant="wc") => ({uid,token:{role,tenantId:tenant,studioId:null},rawToken:"test"});
async function seed(status="pending") {
 const id=`wc-${Date.now()}-${++n}`, now=new Date().toISOString(), customerId=`c-${id}`;
 await db.collection("bookings").doc(id).set({id,tenantId:"wc",studioId:"s",customerId,serviceId:"svc",status:"PENDING",paymentStatus:"unpaid",totalAmount:100000,scheduledAt:new Date(Date.now()+3600000).toISOString(),holdExpiresAt:new Date(Date.now()-60000).toISOString(),createdAt:now,updatedAt:now});
 await db.collection("jobs").doc(id).set({id,tenantId:"wc",studioId:"s",customerId,bookingId:id,status:"PENDING_VEHICLE",paymentStatus:"unpaid",statusHistory:[]});
 await db.collection("payments").doc(id).set({id,tenantId:"wc",studioId:"s",customerId,bookingId:id,jobId:id,status,method:"razorpay_payment_link",amount:100000,currency:"INR",razorpayPaymentLinkId:`link-${id}`,razorpayPaymentId:`pay-${id}`,refundAmount:0});
 return {id,customerId};
}
const req=(s:{id:string;customerId:string},admin=false)=> admin ? adminCancelBooking.run({data:{bookingId:s.id,reason:"wait please",feeAction:"charge"},auth:auth("admin","admin")} as never):cancelBooking.run({data:{bookingId:s.id,reason:"wait please",customerContext:true},auth:auth(s.customerId)} as never);
const doc=async(c:string,id:string)=>(await db.collection(c).doc(id).get()).data()!;
const event=(id:string,type="payment_link.paid")=>({eventType:type,providerEventId:`ev-${id}-${++n}`,providerPaymentLinkId:`link-${id}`,providerPaymentId:`pay-${id}`,providerOrderId:null,referenceId:id,amount:100000,currency:"INR"}) as ProviderWebhookEvent;
describe("waiting cancel retained-slot workflow (emulator fixtures)",()=>{
 for(const status of ["pending","processing"])it(`${status}: customer and admin retain slot; repeat request is idempotent; public projection only`,async()=>{
  for(const admin of [false,true]) {const s=await seed(status);expect(await req(s,admin)).toMatchObject({cancellationPending:true});expect(await req(s,admin)).toMatchObject({cancellationPending:true});
   const b=await doc("bookings",s.id);expect(b.status).toBe("PENDING");expect(Object.keys(b.cancelIntent).sort()).toEqual(["requestedAt","state"]);expect((await doc("jobs",s.id)).status).toBe("PENDING_VEHICLE");expect((await doc("payments",s.id)).status).toBe(status);
  }
 });
 it("other customer and tenant denied",async()=>{const s=await seed();for(const a of [auth("other"),auth(s.customerId,"customer","other")])await expect(cancelBooking.run({data:{bookingId:s.id,reason:"wait",customerContext:true},auth:a} as never)).rejects.toMatchObject({code:"permission-denied"});expect((await db.collection("bookingCancelIntents").doc(s.id).get()).exists).toBe(false);});
 it("both sweeps skip unresolved, review after15min retains; resolved marker does not exempt ordinary expiry/close",async()=>{
  const s=await seed();await req(s);const now=Date.now()+86400000;
  await sweepExpiredBookingHolds(db,now);await flagMissedBookings(db,now);expect((await doc("bookings",s.id)).status).toBe("PENDING");expect((await doc("bookings",s.id)).cancelIntent.state).toBe("needs_review");
  const h=await seed();await db.collection("bookings").doc(h.id).update({cancelIntent:{state:"resolved",requestedAt:new Date().toISOString()}});await sweepExpiredBookingHolds(db,now);expect((await doc("bookings",h.id)).status).toBe("EXPIRED");
  const c=await seed();await db.collection("bookings").doc(c.id).update({cancelIntent:{state:"resolved",requestedAt:new Date().toISOString()},status:"CONFIRMED"});await flagMissedBookings(db,now);expect((await doc("bookings",c.id)).status).toBe("CANCELLED");
 });
 it("failed attempt is nonterminal; verified captured full amount reserves and cancels atomically; reordered/duplicate once only",async()=>{
  const s=await seed();await req(s);await processProviderEvent(db,event(s.id,"payment.failed"));expect((await doc("bookings",s.id)).status).toBe("PENDING");
  const ev=event(s.id);await processProviderEvent(db,ev);expect(await doc("bookings",s.id)).toMatchObject({status:"CANCELLED",refundStatus:"reserved",cancelIntent:{state:"resolved"}});const rs=await db.collection("refundRequests").where("paymentId","==",s.id).get();expect(rs.docs.filter(d=>d.id.startsWith("rr_")).map(d=>d.data().amountPaise)).toEqual([100000]);
  expect((await processProviderEvent(db,ev)).outcome).toBe("duplicate");await processProviderEvent(db,event(s.id,"payment.captured"));await processProviderEvent(db,event(s.id,"payment_link.expired"));expect((await doc("payments",s.id)).status).toBe("completed");
 });
 it("verified terminal cancels without refund, failed/incorrect link does not",async()=>{
  const s=await seed();await req(s);await processProviderEvent(db,{...event(s.id,"payment_link.expired"),providerPaymentLinkId:"wrong"});expect((await doc("bookings",s.id)).status).toBe("PENDING");
  await processProviderEvent(db,event(s.id,"payment_link.cancelled"));expect((await doc("bookings",s.id)).status).toBe("CANCELLED");expect((await doc("payments",s.id)).status).toBe("cancelled");expect((await db.collection("refundRequests").where("paymentId","==",s.id).get()).empty).toBe(true);
 });
 it("missing/mismatched amount/currency refuses resolution",async()=>{for(const patch of [{amount:0},{currency:"USD"},{providerPaymentId:"other"}]){const s=await seed();await req(s);await processProviderEvent(db,{...event(s.id),...patch});expect((await doc("bookings",s.id)).status).toBe("PENDING");}});
 it("reservation conflict records capture but NEVER cancels; retry cannot claim success",async()=>{
  const s=await seed();await req(s);await db.collection("refundRequests").doc(`rr_${s.id}_1`).set({id:`rr_${s.id}_1`,paymentId:s.id,status:"ambiguous",amountPaise:50000,reason:"other"});
  await processProviderEvent(db,event(s.id));expect((await doc("payments",s.id)).status).toBe("completed");expect(await doc("bookings",s.id)).toMatchObject({status:"PENDING",cancelIntent:{state:"needs_review"}});await processProviderEvent(db,event(s.id));expect((await doc("bookings",s.id)).status).toBe("PENDING");
 });
 it("crash after reserve/cancel write plan aborts ALL; retry applies once",async()=>{
  const s=await seed();await req(s);const ev=event(s.id);
  await expect(db.runTransaction(async tx=>{const p=await tx.get(db.collection("payments").doc(s.id));await resolveWaitingCancel(tx,db,p.data() as never,ev,new Date().toISOString());throw Error("fixture crash");})).rejects.toThrow("fixture crash");
  expect((await doc("bookings",s.id)).status).toBe("PENDING");expect((await doc("payments",s.id)).status).toBe("pending");expect((await db.collection("refundRequests").where("paymentId","==",s.id).get()).empty).toBe(true);
  await processProviderEvent(db,ev);expect((await doc("bookings",s.id)).status).toBe("CANCELLED");
 });
 it("concurrent capture vs terminal never changes a completed payment to cancelled or creates two reservations",async()=>{
  const s=await seed();await req(s);
  await Promise.all([processProviderEvent(db,event(s.id)), processProviderEvent(db,event(s.id,"payment_link.expired"))]);
  expect((await doc("bookings",s.id)).status).toBe("CANCELLED");
  expect((await doc("payments",s.id)).status).toBe("completed");
  const requests=await db.collection("refundRequests").where("paymentId","==",s.id).get();
  expect(requests.docs.filter(d=>d.id.startsWith("rr_")).length).toBeLessThanOrEqual(1);
  // If terminal won first, later capture is the explicitly held late-cancelled-booking risk, not silently called reserved.
  const intent=await doc("bookingCancelIntents",s.id);
  if(intent.resolution==="captured_refund_reserved") expect(requests.docs.filter(d=>d.id.startsWith("rr_")).length).toBe(1);
  else expect(intent.resolution).toBe("link_terminal_no_refund");
 });

});

// Cancel requested while an online payment is IN PROGRESS (status "processing"): approved 24 Oct 2026 ruling #2
// (owner delegated "you suggest what's safest"; pick: "Wait for the gateway result, then cancel and record the refund").
// Unpaid PENDING links are NOT covered here: since 28 Oct (eaecd4a2) they are closed at the provider first.
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { adminCancelBooking } from "../../functions/booking/adminCancelBooking.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { sweepExpiredBookingHolds } from "../../lib/booking-hold.js";
import { flagMissedBookings } from "../../lib/missed-bookings.js";
import type { ProviderWebhookEvent } from "../../lib/payment-provider.js";
import { requestWaitingCancel, resolveWaitingCancel } from "../../lib/waiting-cancel.js";
const db = getFirestore(); let n=0;
const auth = (uid:string, role="customer",tenant="wc") => ({uid,token:{role,tenantId:tenant,studioId:null},rawToken:"test"});
async function seed(status="processing") {
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
 for(const status of ["processing"])it(`${status}: customer and admin retain slot; repeat request is idempotent; public projection only`,async()=>{
  for(const admin of [false,true]) {const s=await seed(status);expect(await req(s,admin)).toMatchObject({cancellationPending:true});expect(await req(s,admin)).toMatchObject({cancellationPending:true});
   const b=await doc("bookings",s.id);expect(b.status).toBe("PENDING");expect(Object.keys(b.cancelIntent).sort()).toEqual(["requestedAt","state"]);expect((await doc("jobs",s.id)).status).toBe("PENDING_VEHICLE");expect((await doc("payments",s.id)).status).toBe(status);
  }
 });
 it("other customer and tenant denied",async()=>{const s=await seed();for(const a of [auth("other"),auth(s.customerId,"customer","other")])await expect(cancelBooking.run({data:{bookingId:s.id,reason:"wait",customerContext:true},auth:a} as never)).rejects.toMatchObject({code:"permission-denied"});expect((await db.collection("bookingCancelIntents").doc(s.id).get()).exists).toBe(false);});
 it("failed attempt is nonterminal; verified captured full amount reserves and cancels atomically; reordered/duplicate once only",async()=>{
  const s=await seed();await req(s);await processProviderEvent(db,event(s.id,"payment.failed"));expect((await doc("bookings",s.id)).status).toBe("PENDING");
  const ev=event(s.id);await processProviderEvent(db,ev);expect(await doc("bookings",s.id)).toMatchObject({status:"CANCELLED",refundStatus:"reserved",cancelIntent:{state:"resolved"}});const rs=await db.collection("refundRequests").where("paymentId","==",s.id).get();expect(rs.docs.filter(d=>d.id.startsWith("rr_")).map(d=>d.data().amountPaise)).toEqual([100000]);
  expect((await processProviderEvent(db,ev)).outcome).toBe("duplicate");await processProviderEvent(db,event(s.id,"payment.captured"));await processProviderEvent(db,event(s.id,"payment_link.expired"));expect((await doc("payments",s.id)).status).toBe("completed");
 });
 it("missing/mismatched amount/currency refuses resolution",async()=>{for(const patch of [{amount:0},{currency:"USD"},{providerPaymentId:"other"}]){const s=await seed();await req(s);await processProviderEvent(db,{...event(s.id),...patch});expect((await doc("bookings",s.id)).status).toBe("PENDING");}});
 it("reservation conflict records capture but NEVER cancels; retry cannot claim success",async()=>{
  const s=await seed();await req(s);await db.collection("refundRequests").doc(`rr_${s.id}_1`).set({id:`rr_${s.id}_1`,paymentId:s.id,status:"ambiguous",amountPaise:50000,reason:"other"});
  await processProviderEvent(db,event(s.id));expect((await doc("payments",s.id)).status).toBe("completed");expect(await doc("bookings",s.id)).toMatchObject({status:"PENDING",cancelIntent:{state:"needs_review"}});await processProviderEvent(db,event(s.id));expect((await doc("bookings",s.id)).status).toBe("PENDING");
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

 // Razorpay: a link expiring/cancelling only blocks NEW attempts; an attempt already in progress can authorise
 // late and auto-capture within days (docs: payments/late-authorisation, payment-links/states). So link terminal
 // on a PROCESSING payment must keep the booking, flag staff, and still let a late capture resolve exactly once.
 for(const type of ["payment_link.expired","payment_link.cancelled"])it(`${type} while processing: handled (not ignored by routing), retains booking, needs_review + alert, late capture still cancels once with one reservation`,async()=>{
  const s=await seed();await req(s);
  const r=await processProviderEvent(db,event(s.id,type));expect(r.paymentId).toBe(s.id);
  expect(await doc("bookings",s.id)).toMatchObject({status:"PENDING",cancelIntent:{state:"needs_review"}});
  expect(await doc("payments",s.id)).toMatchObject({status:"processing"});expect((await doc("jobs",s.id)).status).toBe("PENDING_VEHICLE");
  expect(await doc("bookingCancelIntents",s.id)).toMatchObject({state:"needs_review",linkTerminalWhileProcessing:type});
  expect((await doc("staffAlerts",`waiting_cancel_${s.id}`)).kind).toBe("waiting_cancel_link_terminal_processing");
  expect((await db.collection("refundRequests").where("paymentId","==",s.id).get()).empty).toBe(true);
  await processProviderEvent(db,event(s.id));
  expect(await doc("bookings",s.id)).toMatchObject({status:"CANCELLED",refundStatus:"reserved",cancelIntent:{state:"resolved"}});
  const rs=await db.collection("refundRequests").where("paymentId","==",s.id).get();expect(rs.docs.filter(d=>d.id.startsWith("rr_")).map(d=>d.data().amountPaise)).toEqual([100000]);
 });
 it("capture first, then link terminal in any order: payment stays completed, no second reservation",async()=>{
  const s=await seed();await req(s);await processProviderEvent(db,event(s.id));await processProviderEvent(db,event(s.id,"payment_link.expired"));await processProviderEvent(db,event(s.id,"payment_link.cancelled"));
  expect((await doc("payments",s.id)).status).toBe("completed");expect((await doc("bookings",s.id)).status).toBe("CANCELLED");
  expect((await db.collection("refundRequests").where("paymentId","==",s.id).get()).docs.filter(d=>d.id.startsWith("rr_")).length).toBe(1);
 });

 // Legacy/pre-containment intents on a PENDING link (and any stored-pending attempt) must also never cancel on a
 // link terminal alone: payment_link.payments[] shows only captured payments, so terminal != nothing in flight.
 for(const type of ["payment_link.expired","payment_link.cancelled"])it(`${type} on a PENDING-payment waiting intent: retained + needs_review, late capture still cancels once with one reservation`,async()=>{
  const s=await seed("pending");const b=await doc("bookings",s.id),p=await doc("payments",s.id);
  await requestWaitingCancel(db,b as never,p as never,{uid:s.customerId,claims:{role:"customer",tenantId:"wc"}} as never,"legacy");
  await processProviderEvent(db,event(s.id,type));
  expect(await doc("bookings",s.id)).toMatchObject({status:"PENDING",cancelIntent:{state:"needs_review"}});
  expect((await doc("payments",s.id)).status).toBe("pending");expect((await doc("jobs",s.id)).status).toBe("PENDING_VEHICLE");
  expect((await db.collection("refundRequests").where("paymentId","==",s.id).get()).empty).toBe(true);
  await processProviderEvent(db,event(s.id));
  expect(await doc("bookings",s.id)).toMatchObject({status:"CANCELLED",refundStatus:"reserved"});
  const rs=await db.collection("refundRequests").where("paymentId","==",s.id).get();expect(rs.docs.filter(d=>d.id.startsWith("rr_")).map(d=>d.data().amountPaise)).toEqual([100000]);
 });

 // Reviewer finding (28 Oct): a completed payment next to a still-open online link used to skip retention and instant-cancel,
 // leaving a late-capture hole on the open link. Now it fails closed and nothing is cancelled or written.
 for(const open of ["pending","processing"])it(`completed payment + ${open} online link: cancel refused (manual check), booking untouched`,async()=>{
  const s=await seed(open);await db.collection("payments").doc(`${s.id}-done`).set({id:`${s.id}-done`,tenantId:"wc",studioId:"s",customerId:s.customerId,bookingId:s.id,jobId:s.id,status:"completed",method:"razorpay_payment_link",amount:50000,currency:"INR",razorpayPaymentLinkId:`link-${s.id}-done`,razorpayPaymentId:`pay-${s.id}-done`,refundAmount:0});
  for(const admin of [false,true])await expect(req(s,admin)).rejects.toThrow(/manual payment check|still processing/i);
  expect((await doc("bookings",s.id)).status).toBe("PENDING");expect((await doc("jobs",s.id)).status).toBe("PENDING_VEHICLE");expect((await doc("payments",s.id)).status).toBe(open);
 });
});

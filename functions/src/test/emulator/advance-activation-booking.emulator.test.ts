import type * as AdvancePaymentModule from "../../lib/advance-payment.js";
import { it, expect, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { buildAdvancePaymentRequest } from "../../lib/advance-payment.js";
import { mergeFloorJobs } from "@autodeck/core";
import type { Booking, ServiceJob } from "@autodeck/core";
import { createBooking } from "../../functions/booking/createBooking.js";
vi.mock("../../lib/advance-payment.js",async()=>{const actual=await vi.importActual<typeof AdvancePaymentModule>("../../lib/advance-payment.js");return {...actual,advancePaymentEnabled:()=>true};});
const db=getFirestore();
it("old priced studio clients fail before writes; capable customer receives the same 15-minute hold", async () => {
  if (!process.env["FIRESTORE_EMULATOR_HOST"]) throw new Error("emulator required");
  for (const row of JSON.parse(readFileSync(resolve(__dirname,"../fixtures/nonmember-byte-inputs.json"),"utf8")))
    await db.collection(row.collection).doc(row.id).set(row.data);
  vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-10-24T09:00:00Z"));
  const key=`activation-${Math.random()}`;
  const request={data:{ serviceId:"svc-rule-fixture",vehicleId:"3fGoNM3LQQyZnbLUxt19",vehicleCategory:"hatchback",
    studioId:"studio-ahmedabad",scheduledDate:"2026-10-31",scheduledTime:"15:00",payMode:"studio",idempotencyKey:key },
    auth:{uid:"L7QxPdcsJ60NwLUyfHj3Zc2mH1oB",token:{role:"customer",tenantId:"automodz",studioId:null}}};
  try {
    await expect(createBooking.run(request as never)).rejects.toThrow(/Refresh or update/);
    expect((await db.collection("bookingIntents").doc(key).get()).exists).toBe(false);
    const r=await createBooking.run({...request,data:{...request.data,advanceFlowVersion:1}} as never) as {booking:{id:string,status:string,holdExpiresAt:string}};
    expect(r.booking.status).toBe("PENDING");
    expect(r.booking.holdExpiresAt).toBe("2026-10-24T09:15:00.000Z");
    const retry=await createBooking.run({...request,data:{...request.data,advanceFlowVersion:1}} as never) as typeof r;
    expect(retry.booking.id).toBe(r.booking.id);
    const booking=(await db.collection("bookings").doc(r.booking.id).get()).data() as Booking;
    const advance=buildAdvancePaymentRequest({id:booking.id,payMode:booking.payMode!,currency:"INR",priceBreakdown:booking.priceBreakdown},"service_total_only","ceil",{enabled:true});
    const pid=`advance-${booking.id}`,order=`order-${booking.id}`,eid=`event-${booking.id}`;
    await db.collection("payments").doc(pid).set({id:pid,tenantId:booking.tenantId,studioId:booking.studioId,customerId:booking.customerId,
      targetType:"booking",bookingId:booking.id,jobId:null,amount:advance.amountPaise,currency:"INR",status:"pending",method:"razorpay_payment_link",razorpayOrderId:order});
    await db.collection("bookings").doc(booking.id).update({advancePaymentId:pid});
    const secret="local-activation-signature",raw=JSON.stringify({event:"payment.captured",payload:{payment:{entity:{id:`pay-${booking.id}`,order_id:order,amount:advance.amountPaise,currency:"INR",status:"captured"}}}});
    const provider=new RazorpayProvider("rzp_test_local","unused",secret);
    expect(provider.verifyWebhookSignature({rawBody:raw,signature:createHmac("sha256",secret).update(raw).digest("hex")})).toBe(true);
    const ev=provider.parseWebhookEvent(raw);ev.providerEventId=eid;
    expect((await processProviderEvent(db,ev)).outcome).toBe("completed");
    expect((await processProviderEvent(db,ev)).outcome).toBe("duplicate");
    const paid=(await db.collection("bookings").doc(booking.id).get()).data() as Booking;
    expect(paid.status).toBe("CONFIRMED");expect(paid.advancePaidAt).toBeTruthy();expect(paid.holdExpiresAt).toBeNull();
    const jobs=await db.collection("jobs").where("bookingId","==",booking.id).get();
    expect(jobs.size).toBe(1);const job=jobs.docs[0]!.data() as ServiceJob;
    expect(job.bookingId).toBe(booking.id);expect(job.tenantId).toBe(booking.tenantId);expect(job.studioId).toBe(booking.studioId);
    expect(job.status).toBe("PENDING_VEHICLE");expect(job.bayId).toBeTruthy();
    expect(mergeFloorJobs([job],[job],job.scheduledDate,true).map(j=>j.id)).toEqual([job.id]);
    expect(advance.dueAtStudioPaise).toBe(booking.priceBreakdown.total-advance.amountPaise);

  } finally {
    // This file uses the shared static studio/slot fixture. Remove only records
    // created by this activation attempt so the byte-baseline file sees a free bay.
    const intents=await db.collection("bookingIntents").doc(key).get();const bookingId=intents.data()?.["bookingId"];
    if(bookingId){for(const collection of ["jobs","payments"]){const rows=await db.collection(collection).where("bookingId","==",bookingId).get();for(const row of rows.docs)await row.ref.delete();}await db.collection("bookings").doc(bookingId).delete();}
    await db.collection("bookingIntents").doc(key).delete();vi.useRealTimers();
  }
});

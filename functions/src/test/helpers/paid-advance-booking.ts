// Test fixture only: exercise the enabled customer flow through the actual
// booking callable and locally signed advance event before downstream tests.
import { createBooking as actualCreateBooking } from "../../functions/booking/createBooking.js";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac } from "node:crypto";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { buildAdvancePaymentRequest } from "../../lib/advance-payment.js";
import type { Booking } from "@autodeck/core";
export const createBooking = {run: async (request: Parameters<typeof actualCreateBooking.run>[0]) => {
  const result=await actualCreateBooking.run({...request,data:{...request.data,advanceFlowVersion:1}});
  const b=result.booking as Booking;
  if(b.status!=="PENDING" || b.payMode!=="studio")return result;
  if(!process.env["FIRESTORE_EMULATOR_HOST"])throw new Error("fixture requires emulator");
  const db=getFirestore(),id=`advance-${b.id}`,order=`order-${b.id}`;
  const advance=buildAdvancePaymentRequest({id:b.id,payMode:"studio",currency:"INR",priceBreakdown:b.priceBreakdown},"service_total_only","ceil");
  await db.collection("payments").doc(id).set({id,tenantId:b.tenantId,studioId:b.studioId,customerId:b.customerId,
    targetType:"booking",bookingId:b.id,jobId:null,amount:advance.amountPaise,currency:"INR",status:"pending",method:"razorpay_payment_link",razorpayOrderId:order});
  await db.collection("bookings").doc(b.id).update({advancePaymentId:id});
  const secret="local-fixture-signature",raw=JSON.stringify({event:"payment.captured",payload:{payment:{entity:{id:`pay-${b.id}`,order_id:order,amount:advance.amountPaise,currency:"INR",status:"captured"}}}});
  const provider=new RazorpayProvider("rzp_test_local","unused",secret);
  if(!provider.verifyWebhookSignature({rawBody:raw,signature:createHmac("sha256",secret).update(raw).digest("hex")}))throw new Error("fixture signature failed");
  const ev=provider.parseWebhookEvent(raw);ev.providerEventId=`event-${b.id}`;
  const outcome=await processProviderEvent(db,ev);if(outcome.outcome!=="completed")throw new Error("fixture advance failed");
  return {booking:(await db.collection("bookings").doc(b.id).get()).data() as Booking};
}};

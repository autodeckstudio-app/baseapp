import { membershipCoveredLabel } from "@autodeck/core";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cancelState } from "./booking-rules";
const source=(f:string)=>readFileSync(join(__dirname,f),"utf8");
describe("waiting cancellation UI source and policy guards",()=>{
 it("no second cancel or pay offer, no fake local cancelled status",()=>{
  const b={status:"PENDING",scheduledAt:new Date(Date.now()+86400000).toISOString(),totalAmount:100000,cancelIntent:{state:"waiting",requestedAt:new Date().toISOString()}} as never;
  expect(cancelState(b).canCancel).toBe(false);
  const s=source("../app/(tabs)/bookings/[id].tsx");
  expect(s).toContain('if (!result.cancellationPending) setBooking');
  expect(s).toContain('const canPay = !noPaymentDue&&!membershipCoveredLabel(booking) && !waitingCancel');
  expect(s).toContain('{!noPaymentDue&&!waitingCancel && !awaitingLinkId && paymentIsCurrent && (!payment || payment.status === "failed" || payment.status === "cancelled") && booking.status === "PENDING"');
  expect(s).toContain('const showRescheduleSection = placed !== "1" && (!job||job.status==="PENDING_VEHICLE") && !waitingCancel');
  expect(s).toContain('Held while payment is checked.');
  expect(s).toContain('Not cancelled yet.');
  const service=source('./booking-service.ts');
  expect(service.indexOf('return booking;')).toBeLessThan(service.indexOf('return isBookingMissed(booking)'));
 });
 it("exact zero-total has no pay offer; positive unpaid retains it; covered and waiting hide it",()=>{const s=source("../app/(tabs)/bookings/[id].tsx");const condition=s.match(/const canPay = (.*);/)![1]!;const visible=new Function('booking','waitingCancel','membershipCoveredLabel','noPaymentDue','job',`return ${condition}`);const b={totalAmount:0,paymentStatus:'unpaid',status:'CONFIRMED'};expect(visible(b,false,membershipCoveredLabel,true,null)).toBe(false);expect(visible({...b,totalAmount:100},false,membershipCoveredLabel,false,null)).toBe(true);expect(visible({...b,totalAmount:100},true,membershipCoveredLabel,false,null)).toBe(false);expect(visible({...b,membershipWashUsed:true},false,membershipCoveredLabel,true,null)).toBe(false);});
});

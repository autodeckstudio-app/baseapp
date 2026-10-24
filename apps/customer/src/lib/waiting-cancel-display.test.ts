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
  expect(s).toContain('const canPay = !membershipCoveredLabel(booking) && !waitingCancel');
  expect(s).toContain('{!waitingCancel && booking.status === "PENDING"');
  expect(s).toContain('const showRescheduleSection = placed !== "1" && !waitingCancel');
  expect(s).toContain('Your booked time is still held while the online payment is checked.');
  expect(s).toContain('The booking is not cancelled yet.');
  const service=source('./booking-service.ts');
  expect(service.indexOf('return booking;')).toBeLessThan(service.indexOf('return isBookingMissed(booking)'));
 });
 it("noncovered zero-total retains baseline pay offer; covered hides it",()=>{const s=source("../app/(tabs)/bookings/[id].tsx");const condition=s.match(/const canPay = (.*);/)![1]!;const visible=new Function('booking','waitingCancel','membershipCoveredLabel',`return ${condition}`);const b={totalAmount:0,paymentStatus:'unpaid',status:'CONFIRMED'};expect(visible(b,false,membershipCoveredLabel)).toBe(true);expect(visible({...b,membershipWashUsed:true},false,membershipCoveredLabel)).toBe(false);});
});

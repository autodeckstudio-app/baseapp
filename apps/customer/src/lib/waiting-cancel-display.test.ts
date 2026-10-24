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
  expect(s).toContain('const canPay = !waitingCancel');
  expect(s).toContain('{!waitingCancel && booking.status === "PENDING"');
  expect(s).toContain('const showRescheduleSection = !waitingCancel');
  expect(s).toContain('Your booked time is still held while the online payment is checked.');
  expect(s).toContain('The booking is not cancelled yet.');
  const service=source('./booking-service.ts');
  expect(service.indexOf('return booking;')).toBeLessThan(service.indexOf('return isBookingMissed(booking)'));
 });
});

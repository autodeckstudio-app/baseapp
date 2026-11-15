import { membershipCoveredLabel } from "@autodeck/core";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import{canOfferPayment}from'./payment-panel-state';
describe("waiting cancellation staff controls source guard",()=>{
 it("list shows requested and detail hides pay offers while permitting separately verified combined cancellation review",()=>{
  const read=(f:string)=>readFileSync(join(__dirname,f),"utf8");const panel=read('../components/CancelBookingPanel.tsx');
  expect(panel).toContain('booking.cancelIntent?.state === "waiting" || booking.cancelIntent?.state === "needs_review"');expect(panel).toContain('(!booking.combinedPayment||!reviewWaiting)');expect(panel).toContain('I checked the original payment in Razorpay.');
  expect(read('../app/(admin)/bookings/page.tsx')).toContain('"Cancellation requested" : membershipCoveredLabel(b) ?? b.paymentStatus');
  const s=read('../components/JobPaymentPanel.tsx');for(const c of ['link','counter']){const end=s.indexOf(`canOfferPayment(payment, job.paymentStatus).${c}`),start=s.lastIndexOf('{!(',end),condition=s.slice(start,end);expect(condition).toContain('booking?.cancelIntent?.state === "waiting"');expect(condition).toContain('booking?.cancelIntent?.state === "needs_review"');expect(condition).toContain('!membershipCoveredLabel(job)');expect(condition).toContain('!(booking && membershipCoveredLabel(booking))');}
 });
 it("noncovered zero-total retains legacy unpaid offers, covered stays hidden, and unread payment never offers collection",()=>{expect(membershipCoveredLabel({totalAmount:0}as any)).toBeNull();expect(canOfferPayment(null,'unpaid')).toEqual({link:true,counter:true});expect(canOfferPayment(undefined,'unpaid')).toEqual({link:false,counter:false});expect(membershipCoveredLabel({totalAmount:0,membershipWashUsed:true}as any)).toBeTruthy();});
});

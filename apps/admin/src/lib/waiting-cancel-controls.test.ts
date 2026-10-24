import { membershipCoveredLabel } from "@autodeck/core";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("waiting cancellation staff controls source guard",()=>{
 it("list shows requested and detail hides cancel/payment offers",()=>{
  const read=(f:string)=>readFileSync(join(__dirname,f),"utf8");
  expect(read('../components/CancelBookingPanel.tsx')).toContain('if (booking.cancelIntent?.state === "waiting"');
  expect(read('../app/(admin)/bookings/page.tsx')).toContain('"Cancellation requested" : membershipCoveredLabel(b) ?? b.paymentStatus');
  const s=read('../app/(admin)/jobs/[id]/page.tsx');
  for(const c of ['link','counter'])expect(s).toContain(`!(booking?.cancelIntent?.state === "waiting" || booking?.cancelIntent?.state === "needs_review") && !membershipCoveredLabel(job) && !(booking && membershipCoveredLabel(booking)) && canOfferPayment(payment, job.paymentStatus).${c}`);
 });
 it("noncovered zero-total retains both baseline offers; covered hides them",()=>{const s=readFileSync(join(__dirname,'../app/(admin)/jobs/[id]/page.tsx'),'utf8');for(const c of ['link','counter']){const marker=` && canOfferPayment(payment, job.paymentStatus).${c}`;const end=s.indexOf(marker);const start=s.lastIndexOf('{!(',end);const condition=s.slice(start+1,end);const visible=new Function('job','booking','membershipCoveredLabel',`return ${condition}`);expect(visible({totalAmount:0},null,membershipCoveredLabel)).toBe(true);expect(visible({totalAmount:0,membershipWashUsed:true},null,membershipCoveredLabel)).toBe(false);}});
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("waiting cancellation staff controls source guard",()=>{
 it("list shows requested and detail hides cancel/payment offers",()=>{
  const read=(f:string)=>readFileSync(join(__dirname,f),"utf8");
  expect(read('../components/CancelBookingPanel.tsx')).toContain('if (booking.cancelIntent?.state === "waiting"');
  expect(read('../app/(admin)/bookings/page.tsx')).toContain('"Cancellation requested" : b.paymentStatus');
  const s=read('../app/(admin)/jobs/[id]/page.tsx');
  for(const c of ['link','counter'])expect(s).toContain(`!(booking?.cancelIntent?.state === "waiting" || booking?.cancelIntent?.state === "needs_review") && canOfferPayment(payment, job.paymentStatus).${c}`);
 });
});

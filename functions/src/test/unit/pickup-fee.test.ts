import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { PriceBreakdown } from "@autodeck/core";
import { applyPickupFees, legFees } from "../../lib/pickup-fee.js";
import { calculatePrice, applyMembershipBenefit } from "../../lib/pricing.js";
import { buildInvoice } from "../../lib/invoice-builder.js";

const base = (rate: number): PriceBreakdown => calculatePrice({ basePrice: 50000, vehicleCategory: "suv", vehicleCategoryPricing: [], taxRatePercent: rate, taxDescription: rate ? `GST ${rate}%` : "No GST" });

describe("pickup fee legs", () => {
  it("per leg from the stored fee", () => {
    expect(legFees("pickup", 10000)).toEqual({ pickup: 10000, drop: 0 });
    expect(legFees("drop", 10000)).toEqual({ pickup: 0, drop: 10000 });
    expect(legFees("both", 20000)).toEqual({ pickup: 10000, drop: 10000 });
    expect(legFees("both", 33000)).toEqual({ pickup: 16500, drop: 16500 });
    expect(legFees("pickup", 16500)).toEqual({ pickup: 16500, drop: 0 });
    expect(legFees("both", 0)).toEqual({ pickup: 0, drop: 0 });
    expect(legFees("both", null)).toEqual({ pickup: 0, drop: 0 });
  });
});
describe("fee on the price, GST off", () => {
  it("adds exactly the fee, no tax", () => {
    const pb = applyPickupFees(base(0), 10000, 10000);
    expect(pb).toMatchObject({ pickupFee: 10000, dropFee: 10000, subtotal: 70000, tax: 0, total: 70000 });
  });
  it("is absolute: applying twice, or removing, restores the original", () => {
    const b = base(0);
    const once = applyPickupFees(b, 10000, 0);
    expect(applyPickupFees(once, 10000, 0)).toEqual(once);
    expect(applyPickupFees(once, 0, 0)).toEqual(b);
  });
});
describe("fee on the price, with the studio's own rate (no invented rate)", () => {
  it("taxes the fee at the breakdown's rate", () => {
    const pb = applyPickupFees(base(18), 10000, 10000);
    expect(pb.taxRatePercent).toBe(18);
    expect(pb.tax).toBe(Math.round((70000 * 18) / 100));
    expect(pb.total).toBe(pb.subtotal + pb.tax);
  });
  it("a membership discount stays and tax follows subtotal minus discount", () => {
    const withDisc = applyMembershipBenefit(base(18), { discountPercent: 10, consumeWash: false });
    const pb = applyPickupFees(withDisc, 10000, 0);
    expect(pb.membershipDiscount).toBe(withDisc.membershipDiscount);
    expect(pb.total).toBe(pb.subtotal - (pb.membershipDiscount ?? 0) + pb.tax);
  });
});
describe("invoice carries the fee as lines and adds up", () => {
  const mk = (rate: number) => {
    const pb = applyPickupFees(base(rate), 10000, 10000);
    return buildInvoice({ invoiceId: "i", invoiceNumber: "N1", tenantId: "t", studioId: "s", jobId: "j", bookingId: "b", customerId: "c", vehicleId: "v", priceBreakdown: pb, paymentId: "p", serviceName: "Wash" });
  };
  for (const rate of [0, 18]) {
    it(`rate ${rate}: Pickup Fee and Drop Fee lines, and subtotal - discount + tax = total`, () => {
      const inv = mk(rate);
      expect(inv.lineItems.map((l) => l.description)).toEqual(["Wash", "Pickup Fee", "Drop Fee"]);
      expect(inv.subtotal - inv.discount + inv.tax).toBe(inv.total);
    });
  }
});
describe("the server wiring", () => {
  const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
  it("never edits a job that has an invoice or a payment, and reads before it writes", () => {
    expect(src).toContain("const locked = invoiced");
    expect(src).toContain("feeUnbilled");
    expect(src.indexOf("tx.get(bRef)")).toBeLessThan(src.indexOf("tx.update(jobDoc.ref"));
  });
});

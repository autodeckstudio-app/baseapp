import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

const audits: Array<{ action: string }> = [];
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: unknown, p: { action: string }) => { audits.push(p); } }));

import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { calculatePrice } from "../../lib/pricing.js";
import { fakeFirestore } from "./fake-firestore.js";

const SECRET = "whsec_test";
const provider = new RazorpayProvider("rzp_test_x", "secret", SECRET);
const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

const pb = calculatePrice({ serviceCategory: "ppf", basePrice: 500000, vehicleCategory: "hatchback", vehicleCategoryPricing: [] });
const AMOUNT = pb.total;

function seed(over: Record<string, unknown> = {}) {
  return {
    services: { svcA: { tenantId: "t", name: "Premium Wash" } },
    vehicles: { v1: { tenantId: "t", ownerId: "c1", registrationNumber: "GJ01AB1234", make: "Tata", model: "Nexon", year: 2022, color: "Blue", photoUrl: null } },
    customers: { c1: { tenantId: "t", name: "Asha" } },
    jobs: { job1: { id: "job1", tenantId: "t", studioId: "s", bookingId: "b1", customerId: "c1", vehicleId: "v1", serviceId: "svcA", status: "COMPLETED", paymentStatus: "unpaid", priceBreakdown: pb, totalAmount: AMOUNT, additionalWorkDelta: 0 } },
    bookings: { b1: { id: "b1", paymentStatus: "unpaid" } },
    payments: { pay1: { id: "pay1", tenantId: "t", studioId: "s", targetType: "job", jobId: "job1", bookingId: "b1", membershipId: null, customerId: "c1", amount: AMOUNT, currency: "INR", method: "razorpay_payment_link", status: "pending", razorpayPaymentLinkId: "plink_1", razorpayPaymentId: null, razorpayOrderId: null, invoiceId: null } },
    ...over,
  } as never;
}

const linkPaid = (id: string, amount = AMOUNT) =>
  JSON.stringify({ entity: "event", event: "payment.link.paid", payload: {
    payment: { entity: { id: "pay_abc", order_id: "order_1", amount, currency: "INR" } },
    payment_link: { entity: { id: "plink_1", reference_id: "pay1", amount } } }, _id: id });

function ev(raw: string, id: string) {
  const e = provider.parseWebhookEvent(raw);
  e.providerEventId = id;
  return e;
}

describe("signature", () => {
  it("accepts the right HMAC and rejects wrong, empty and unset-secret cases", () => {
    const body = '{"a":1}';
    expect(provider.verifyWebhookSignature({ rawBody: body, signature: sign(body) })).toBe(true);
    expect(provider.verifyWebhookSignature({ rawBody: body, signature: sign(body + " ") })).toBe(false);
    expect(provider.verifyWebhookSignature({ rawBody: body, signature: "" })).toBe(false);
    expect(provider.verifyWebhookSignature({ rawBody: body, signature: "abc" })).toBe(false);
    const noSecret = new RazorpayProvider("k", "s", "");
    expect(noSecret.verifyWebhookSignature({ rawBody: body, signature: createHmac("sha256", "").update(body).digest("hex") })).toBe(false);
  });
});

describe("parseWebhookEvent", () => {
  it("reads the payment link, reference id, payment id and amount; falls back to a body hash for the event id", () => {
    const e = provider.parseWebhookEvent(linkPaid("x").replace(',"_id":"x"', ""));
    expect(e).toMatchObject({ eventType: "payment.link.paid", providerPaymentId: "pay_abc", providerPaymentLinkId: "plink_1", referenceId: "pay1", amount: AMOUNT });
    expect(e.providerEventId).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("processProviderEvent", () => {
  it("payment.link.paid: completes the payment, issues the invoice, marks job and booking paid", async () => {
    audits.length = 0;
    const { db, data } = fakeFirestore(seed());
    const r = await processProviderEvent(db, ev(linkPaid("1"), "evt_1"));
    expect(r).toEqual({ outcome: "completed", paymentId: "pay1" });
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "completed", razorpayPaymentId: "pay_abc" });
    expect(data["payments"]!["pay1"]!["invoiceId"]).toBeTruthy();
    expect(Object.keys(data["invoices"] ?? {})).toHaveLength(1);
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("paid");
    expect(data["bookings"]!["b1"]!["paymentStatus"]).toBe("paid");
    expect(audits.map((a) => a.action)).toEqual(["payment.completed", "invoice.issued"]);
  });

  it("the same event delivered twice changes nothing the second time", async () => {
    const { db, data } = fakeFirestore(seed());
    await processProviderEvent(db, ev(linkPaid("1"), "evt_1"));
    const r2 = await processProviderEvent(db, ev(linkPaid("1"), "evt_1"));
    expect(r2.outcome).toBe("duplicate");
    expect(Object.keys(data["invoices"] ?? {})).toHaveLength(1);
  });

  it("payment.captured after payment.link.paid (a different event id) does not issue a second invoice", async () => {
    const { db, data } = fakeFirestore(seed());
    await processProviderEvent(db, ev(linkPaid("1"), "evt_1"));
    const captured = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_abc", order_id: "order_1", amount: AMOUNT, currency: "INR" } } } });
    const r = await processProviderEvent(db, ev(captured, "evt_2"));
    expect(r.outcome).toBe("already_final");
    expect(Object.keys(data["invoices"] ?? {})).toHaveLength(1);
  });

  it("an amount that does not match the stored payment is never marked paid", async () => {
    const { db, data } = fakeFirestore(seed());
    const r = await processProviderEvent(db, ev(linkPaid("1", AMOUNT - 100), "evt_1"));
    expect(r.outcome).toBe("amount_mismatch");
    expect(data["payments"]!["pay1"]!["status"]).toBe("pending");
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("unpaid");
    expect(data["invoices"]).toBeUndefined();
  });

  it("an event for a payment we do not know is acknowledged and recorded, nothing else", async () => {
    const { db, data } = fakeFirestore(seed());
    const other = linkPaid("1").replace('"reference_id":"pay1"', '"reference_id":"nope"').replace('"id":"plink_1"', '"id":"plink_zzz"').replace('"pay_abc"', '"pay_zzz"').replace('"order_1"', '"order_zzz"');
    const r = await processProviderEvent(db, ev(other, "evt_9"));
    expect(r).toEqual({ outcome: "unknown_payment", paymentId: null });
    expect(data["paymentEvents"]!["evt_9"]).toBeTruthy();
    expect(data["payments"]!["pay1"]!["status"]).toBe("pending");
  });

  it("a failed attempt on a payment link leaves it payable; a later paid event still completes it", async () => {
    const { db, data } = fakeFirestore(seed());
    const failed = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_f", order_id: "order_1", amount: AMOUNT } }, payment_link: { entity: { id: "plink_1", reference_id: "pay1" } } } });
    expect((await processProviderEvent(db, ev(failed, "evt_f"))).outcome).toBe("failed");
    expect(data["payments"]!["pay1"]!["status"]).toBe("pending");
    expect((await processProviderEvent(db, ev(linkPaid("2"), "evt_p"))).outcome).toBe("completed");
  });

  it("a cancelled job still records the money as received but is flagged and gets no invoice", async () => {
    audits.length = 0;
    const s = seed() as any;
    s.jobs.job1.status = "CANCELLED";
    const { db, data } = fakeFirestore(s);
    const r = await processProviderEvent(db, ev(linkPaid("1"), "evt_1"));
    expect(r.outcome).toBe("completed");
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
    expect(data["invoices"]).toBeUndefined();
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("unpaid");
  });

  it("membership payment activates the pending membership", async () => {
    const s = seed() as any;
    s.payments.pay1 = { ...s.payments.pay1, targetType: "membership", jobId: null, membershipId: "m1", studioId: null };
    s.memberships = { m1: { id: "m1", status: "pending" } };
    const { db, data } = fakeFirestore(s);
    expect((await processProviderEvent(db, ev(linkPaid("1"), "evt_1"))).outcome).toBe("completed");
    expect(data["memberships"]!["m1"]).toMatchObject({ status: "active", activatedBy: "system" });
  });

  it("refund.created on a completed, invoiced payment refunds it, voids the invoice and marks the job refunded", async () => {
    const { db, data } = fakeFirestore(seed());
    await processProviderEvent(db, ev(linkPaid("1"), "evt_1"));
    const refund = JSON.stringify({ event: "refund.created", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_abc", amount: AMOUNT } } } });
    const r = await processProviderEvent(db, ev(refund, "evt_r"));
    expect(r.outcome).toBe("refunded");
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "refunded", razorpayRefundId: "rfnd_1" });
    expect(Object.values(data["invoices"]!)[0]).toMatchObject({ status: "void" });
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("refunded");
    const again = await processProviderEvent(db, ev(refund, "evt_r2"));
    expect(again.outcome).toBe("already_final");
  });
});

// FIXTURES shaped after Razorpay's documented payment_link.* payloads (not live captures).
describe("documented payment_link.* events (local, fail-closed)", () => {
  const body = (event: string, o: { amount?: number; currency?: string; linkId?: string; refId?: string } = {}) => JSON.stringify({ entity: "event", event, payload: {
    payment: { entity: { id: "pay_abc", order_id: "order_1", ...(o.amount === undefined ? {} : { amount: o.amount }), currency: o.currency ?? "INR" } },
    payment_link: { entity: { id: o.linkId ?? "plink_1", reference_id: o.refId ?? "pay1", ...(o.amount === undefined ? {} : { amount: o.amount }) } } } });
  const mk = () => { const f = fakeFirestore(seed()); (f.data["payments"]!["pay1"] as Record<string, unknown>)["razorpayPaymentLinkId"] = "plink_1"; return f; };

  it("payment_link.paid completes with matching link id, amount and INR", async () => {
    const { db, data } = mk();
    const r = await processProviderEvent(db, ev(body("payment_link.paid", { amount: AMOUNT }), "e1"));
    expect(r.outcome).toBe("completed");
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "completed" });
  });
  it("payment_link.paid with missing amount, wrong amount, wrong currency or another link id completes nothing", async () => {
    for (const [i, o] of [[1, {}], [2, { amount: AMOUNT + 1 }], [3, { amount: AMOUNT, currency: "USD" }], [4, { amount: AMOUNT, linkId: "plink_other" }], [5, { amount: AMOUNT, refId: "someone_else" }]] as const) {
      const { db, data } = mk();
      const r = await processProviderEvent(db, ev(body("payment_link.paid", o), `e${i}`));
      expect(["amount_mismatch", "unknown_payment"]).toContain(r.outcome);
      expect(data["payments"]!["pay1"]!["status"]).not.toBe("completed");
    }
  });
  it("payment_link.expired on a pending payment records link_expired but does not finalise it; a later capture still completes", async () => {
    const { db, data } = mk();
    expect((await processProviderEvent(db, ev(body("payment_link.expired"), "x1"))).outcome).toBe("link_expired");
    expect(data["payments"]!["pay1"]!["status"]).toBe("pending");
    expect(data["bookings"]!["b1"]!["paymentStatus"]).toBe("unpaid");
    const r = await processProviderEvent(db, ev(body("payment.captured", { amount: AMOUNT }), "x2"));
    expect(r.outcome).toBe("completed");
  });
  it("payment_link.cancelled with a non-matching link id is not applied; replay is a duplicate", async () => {
    const { db, data } = mk();
    expect((await processProviderEvent(db, ev(body("payment_link.cancelled", { linkId: "plink_other" }), "c1"))).outcome).toBe("unknown_payment");
    expect(data["payments"]!["pay1"]!["linkTerminal"]).toBeUndefined();
    expect((await processProviderEvent(db, ev(body("payment_link.cancelled"), "c2"))).outcome).toBe("link_cancelled");
    expect((await processProviderEvent(db, ev(body("payment_link.cancelled"), "c2"))).outcome).toBe("duplicate");
  });
  it("payment_link.expired after completion is already_final and changes nothing", async () => {
    const { db, data } = mk();
    await processProviderEvent(db, ev(body("payment_link.paid", { amount: AMOUNT }), "p1"));
    expect((await processProviderEvent(db, ev(body("payment_link.expired"), "p2"))).outcome).toBe("already_final");
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
  });
  it("two tenants: conflicting identifiers cannot complete either payment", async () => {
    const f = mk();
    const p1 = f.data["payments"]!["pay1"] as Record<string, unknown>;
    f.data["payments"]!["pay2"] = { ...p1, id: "pay2", tenantId: "u", razorpayPaymentLinkId: "plink_2", status: "pending" };
    // reference says tenant t's payment, link says tenant u's payment
    const r = await processProviderEvent(f.db, ev(body("payment_link.paid", { amount: AMOUNT, linkId: "plink_2" }), "k1"));
    expect(r.outcome).toBe("unknown_payment");
    expect(f.data["payments"]!["pay1"]!["status"]).toBe("pending");
    expect(f.data["payments"]!["pay2"]!["status"]).toBe("pending");
    // link only (no reference id) selects exactly the payment that stores that link
    const noRef = JSON.stringify({ entity: "event", event: "payment_link.paid", payload: { payment: { entity: { id: "pay_zzz", amount: AMOUNT, currency: "INR" } }, payment_link: { entity: { id: "plink_2", amount: AMOUNT } } } });
    expect((await processProviderEvent(f.db, ev(noRef, "k2"))).outcome).toBe("completed");
    expect(f.data["payments"]!["pay2"]!["status"]).toBe("completed");
    expect(f.data["payments"]!["pay1"]!["status"]).toBe("pending");
  });
  it("a different provider payment id than the one already stored is rejected; stored currency is used", async () => {
    const f = mk();
    (f.data["payments"]!["pay1"] as Record<string, unknown>)["razorpayPaymentId"] = "pay_stored";
    expect((await processProviderEvent(f.db, ev(body("payment_link.paid", { amount: AMOUNT }), "m1"))).outcome).toBe("unknown_payment");
  });
  it("duplicate link id across two tenants is ambiguous and completes neither (link-only variant too)", async () => {
    const f = mk();
    const p1 = f.data["payments"]!["pay1"] as Record<string, unknown>;
    f.data["payments"]!["pay2"] = { ...p1, id: "pay2", tenantId: "u", status: "pending" }; // synthetic: same link id
    const noRef = JSON.stringify({ entity: "event", event: "payment_link.paid", payload: { payment: { entity: { id: "pay_q", amount: AMOUNT, currency: "INR" } }, payment_link: { entity: { id: "plink_1", amount: AMOUNT } } } });
    expect((await processProviderEvent(f.db, ev(noRef, "d1"))).outcome).toBe("ambiguous_link");
    expect((await processProviderEvent(f.db, ev(body("payment_link.paid", { amount: AMOUNT }), "d2"))).outcome).toBe("ambiguous_link");
    expect((await processProviderEvent(f.db, ev(body("payment_link.expired"), "d3"))).outcome).toBe("ambiguous_link");
    expect(f.data["payments"]!["pay1"]!["status"]).toBe("pending");
    expect(f.data["payments"]!["pay2"]!["status"]).toBe("pending");
  });
  it("a stored payment with no currency is not completed by payment_link.paid", async () => {
    const f = mk();
    delete (f.data["payments"]!["pay1"] as Record<string, unknown>)["currency"];
    expect((await processProviderEvent(f.db, ev(body("payment_link.paid", { amount: AMOUNT }), "n1"))).outcome).toBe("amount_mismatch");
    expect(f.data["payments"]!["pay1"]!["status"]).toBe("pending");
  });
});

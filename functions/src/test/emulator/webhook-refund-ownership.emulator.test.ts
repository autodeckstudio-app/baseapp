/**
 * Refund-outbox ownership guard on the DEPLOYED webhook vintage: a
 * refund.created that belongs to the refund outbox is recorded but never
 * generically projected (no premature full-amount write, no invoice void),
 * durable across the outbox lifecycle and webhook/runner order permutations.
 * Legacy/dashboard refunds (no outbox owner) keep the generic path.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import type { ProviderWebhookEvent } from "../../lib/payment-provider.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

function payment(o: Record<string, unknown> = {}): Payment {
  return {
    id: uid("pay"), tenantId: "t1", studioId: "s1", targetType: "job", jobId: uid("job"), bookingId: uid("b"),
    membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: "rzp_pay_1", razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o,
  } as Payment;
}

/** A persisted outbox request as the extraction branch writes it. */
async function seedRequest(p: Payment, o: { id?: string; amountPaise: number; status: string; providerRefundId?: string | null }) {
  const id = o.id ?? `rr_${p.id}_1`;
  await db.collection(COLLECTIONS.refundRequests()).doc(id).set({
    id, tenantId: p.tenantId, studioId: p.studioId, paymentId: p.id,
    jobId: p.jobId, bookingId: p.bookingId, amountPaise: o.amountPaise,
    reason: "test", status: o.status, providerRefundId: o.providerRefundId ?? null,
    projectionNeeded: false, leaseBy: null, leaseAt: null, lastError: null,
    createdBy: "admin", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  return id;
}

async function seedPayment(p: Payment) {
  await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
  if (p.jobId) await db.collection(COLLECTIONS.jobs()).doc(p.jobId).set({ id: p.jobId, tenantId: p.tenantId, bookingId: p.bookingId ?? null, paymentStatus: "paid" });
  if (p.bookingId) await db.collection(COLLECTIONS.bookings()).doc(p.bookingId).set({ id: p.bookingId, tenantId: p.tenantId, paymentStatus: "paid" });
}

function refundEvent(p: Payment, o: Partial<ProviderWebhookEvent>): ProviderWebhookEvent {
  return {
    eventType: "refund.created", providerEventId: uid("evt"), providerPaymentId: p.razorpayPaymentId!,
    providerPaymentLinkId: "pl1", providerRefundId: "rfnd_x", referenceId: p.id,
    amount: p.amount, currency: "INR",
    providerRefundAmount: 50000, providerRefundCurrency: "INR", providerRefundReceipt: null,
    providerRefundPaymentId: p.razorpayPaymentId ?? null, providerRefundStatus: "processed",
    ...o,
  } as ProviderWebhookEvent;
}

beforeEach(async () => {
  for (const col of [COLLECTIONS.payments(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentRefunds(), COLLECTIONS.paymentEvents(), COLLECTIONS.invoices(), COLLECTIONS.jobs(), COLLECTIONS.bookings()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  const { mockProvider } = await import("../../lib/mock-payment-provider.js");
  mockProvider.reset();
});

describe("webhook refund.created outbox ownership", () => {
  it("webhook FIRST (reservation exists, not yet submitted, refund still pending): recorded as outbox_owned, zero payment writes, NO drain", async () => {
    const p = payment();
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "reserved" });
    // Pending evidence: owned, recorded, nothing moves (no projection, no drain).
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId, providerRefundStatus: "pending" }));
    expect(r.outcome).toBe("outbox_owned");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(reqId).get()).data() as Record<string, unknown>;
    expect(req.status).toBe("reserved"); // untouched: pending evidence drives nothing
  });

  it("delayed webhook AFTER full projection (guard released, request projected): still owned, no double projection", async () => {
    const p = payment({ status: "refunded", refundAmount: 100000, razorpayRefundId: "rfnd_full" });
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 100000, status: "projected", providerRefundId: "rfnd_full" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId, providerRefundId: "rfnd_full", providerRefundAmount: 100000 }));
    // Payment is already refunded: the vintage already_final guard owns this order.
    expect(r.outcome).toBe("already_final");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(100000); // unchanged
  });

  it("delayed webhook AFTER PARTIAL projection: still outbox-owned, never bumped to full", async () => {
    const p = payment({ status: "partially_refunded" as never, refundAmount: 50000, razorpayRefundId: "rfnd_p" });
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "projected", providerRefundId: "rfnd_p" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId, providerRefundId: "rfnd_p" }));
    // Partial payments now continue to ownership evaluation (truthful partial
    // accounting); ownership is durable, so the event is owned - zero writes.
    expect(r.outcome).toBe("outbox_owned");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded");
    expect(pay.refundAmount).toBe(50000);
  });

  it("recognized ownership with conflicting binding FAILS CLOSED: ownership_mismatch, zero financial writes", async () => {
    const p = payment();
    await seedPayment(p);
    const other = payment();
    await seedPayment(other);
    const reqId = await seedRequest(other, { amountPaise: 50000, status: "submitted", providerRefundId: "rfnd_x" });
    // Receipt exists but belongs to ANOTHER payment -> recognized evidence, conflicting binding -> hold, never generic projection.
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId }));
    expect(r.outcome).toBe("ownership_mismatch");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
    // Amount mismatch on THIS payment's own request: still fail-closed.
    const p2 = payment({ invoiceId: "inv-m" });
    await seedPayment(p2);
    await db.collection(COLLECTIONS.invoices()).doc("inv-m").set({ id: "inv-m", status: "issued" });
    const req2 = await seedRequest(p2, { amountPaise: 30000, status: "submitted" });
    const r2 = await processProviderEvent(db, refundEvent(p2, { providerRefundReceipt: req2, providerRefundAmount: 50000 }));
    expect(r2.outcome).toBe("ownership_mismatch");
    const pay2 = (await db.collection(COLLECTIONS.payments()).doc(p2.id).get()).data() as Payment;
    expect(pay2.status).toBe("completed");
    const inv2 = (await db.collection(COLLECTIONS.invoices()).doc("inv-m").get()).data() as { status: string };
    expect(inv2.status).toBe("issued");
    // Missing currency evidence never "agrees".
    const p3 = payment();
    await seedPayment(p3);
    const req3 = await seedRequest(p3, { amountPaise: 50000, status: "submitted" });
    const r3 = await processProviderEvent(db, refundEvent(p3, { providerRefundReceipt: req3, providerRefundCurrency: null }));
    expect(r3.outcome).toBe("ownership_mismatch");
    // Our receipt namespace with NO persisted request: malformed known-ownership evidence -> hold.
    const p4 = payment();
    await seedPayment(p4);
    const r4 = await processProviderEvent(db, refundEvent(p4, { providerRefundReceipt: "rr_nonexistent_1" }));
    expect(r4.outcome).toBe("ownership_mismatch");
    const pay4 = (await db.collection(COLLECTIONS.payments()).doc(p4.id).get()).data() as Payment;
    expect(pay4.status).toBe("completed");
  });

  it("unrelated refund without affirmative processed status is held, never projected", async () => {
    // pending lifecycle
    const p = payment({ invoiceId: "inv-p" });
    await seedPayment(p);
    await db.collection(COLLECTIONS.invoices()).doc("inv-p").set({ id: "inv-p", status: "issued" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundStatus: "pending" }));
    expect(r.outcome).toBe("refund_pending");
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
    expect(((await db.collection(COLLECTIONS.invoices()).doc("inv-p").get()).data() as { status: string }).status).toBe("issued");
    // missing lifecycle status
    const p2 = payment();
    await seedPayment(p2);
    const r2 = await processProviderEvent(db, refundEvent(p2, { providerRefundStatus: null }));
    expect(r2.outcome).toBe("refund_pending");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p2.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    // sequence: the SAME refund later arrives as a REAL refund.processed event
    // -> now it projects with truthful accounting (new provider event id).
    const r3 = await processProviderEvent(db, refundEvent(p2, { eventType: "refund.processed", providerRefundStatus: "processed", providerRefundId: "rfnd_x", providerRefundAmount: 100000 }));
    expect(r3.outcome).toBe("refunded");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p2.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(100000);
  });

  it("legacy refunds (receipt refund_<paymentId>, no outbox request) keep the generic projection incl. invoice void", async () => {
    const p = payment({ invoiceId: "inv1" });
    await seedPayment(p);
    await db.collection(COLLECTIONS.invoices()).doc("inv1").set({ id: "inv1", status: "issued" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: `refund_${p.id}`, providerRefundAmount: 100000 }));
    expect(r.outcome).toBe("refunded");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    const inv = (await db.collection(COLLECTIONS.invoices()).doc("inv1").get()).data() as { status: string };
    expect(inv.status).toBe("void"); // existing legacy obligation preserved
  });

  it("refund.processed: outbox-owned stays owned (never GENERICALLY projected - it projects through the outbox's own truthful path); unrelated projects truthfully across partials", async () => {
    // Outbox-owned refund.processed: recorded owned, then the drain ADOPTS
    // the evidence and projects through the outbox projection (ledger source
    // "outbox", no generic full-amount write, no provider call).
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    const p = payment();
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "submitted", providerRefundId: "rfnd_o" });
    const r = await processProviderEvent(db, refundEvent(p, { eventType: "refund.processed", providerRefundReceipt: reqId, providerRefundId: "rfnd_o", providerRefundAmount: 50000 }));
    expect(r.outcome).toBe("outbox_owned");
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded"); // truthful 50000 of 100000, NOT a generic full write
    expect(pay.refundAmount).toBe(50000);
    expect(pay.razorpayRefundId).toBe("rfnd_o");
    expect(mockProvider.initiateRefundCallCount).toBe(0);
    const ownedLedger = await db.collection(COLLECTIONS.paymentRefunds()).get();
    expect(ownedLedger.size).toBe(1);
    expect(ownedLedger.docs[0]!.data()).toMatchObject({ source: "outbox", requestId: reqId, providerRefundId: "rfnd_o" });

    // Unrelated dashboard PARTIAL refund via refund.processed: truthful amount,
    // partial status, invoice NOT voided.
    const p2 = payment({ invoiceId: "inv-pp" });
    await seedPayment(p2);
    await db.collection(COLLECTIONS.invoices()).doc("inv-pp").set({ id: "inv-pp", status: "issued" });
    const r2 = await processProviderEvent(db, refundEvent(p2, { eventType: "refund.processed", providerRefundId: "rfnd_a", providerRefundAmount: 40000 }));
    expect(r2.outcome).toBe("refunded");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p2.id).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded");
    expect(pay.refundAmount).toBe(40000); // truthful partial, NOT the payment amount
    expect(((await db.collection(COLLECTIONS.invoices()).doc("inv-pp").get()).data() as { status: string }).status).toBe("issued");
    // A second partial event on the same payment accumulates to full -> now voids.
    const r3 = await processProviderEvent(db, refundEvent(p2, { eventType: "refund.processed", providerRefundId: "rfnd_b", providerRefundAmount: 60000 }));
    expect(r3.outcome).toBe("refunded");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p2.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(100000);
    expect(((await db.collection(COLLECTIONS.invoices()).doc("inv-pp").get()).data() as { status: string }).status).toBe("void");

    // A processed refund with NO refund-entity amount is incomplete evidence: held, zero writes.
    const p3 = payment();
    await seedPayment(p3);
    const r4 = await processProviderEvent(db, refundEvent(p3, { eventType: "refund.processed", providerRefundAmount: null }));
    expect(r4.outcome).toBe("refund_pending");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p3.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
  });

  it("per-refund identity ledger: same refund across event types and duplicate deliveries counts ONCE", async () => {
    const p = payment({ invoiceId: "inv-led" });
    await seedPayment(p);
    await db.collection(COLLECTIONS.invoices()).doc("inv-led").set({ id: "inv-led", status: "issued" });
    // Same partial refund, first as refund.created with processed status...
    const r1 = await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_same", providerRefundAmount: 40000, providerRefundStatus: "processed" }));
    expect(r1.outcome).toBe("refunded");
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(40000);
    // ...then as refund.processed with a DISTINCT provider event id: NOT counted again.
    const r2 = await processProviderEvent(db, refundEvent(p, { eventType: "refund.processed", providerRefundId: "rfnd_same", providerRefundAmount: 40000 }));
    expect(r2.outcome).toBe("duplicate");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(40000); // exactly once
    expect((pay.status as string)).toBe("partially_refunded");
    // A DIFFERENT refund id accumulates once more.
    const r3 = await processProviderEvent(db, refundEvent(p, { eventType: "refund.processed", providerRefundId: "rfnd_other", providerRefundAmount: 60000 }));
    expect(r3.outcome).toBe("refunded");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(100000);
    expect(pay.status).toBe("refunded");
    expect(((await db.collection(COLLECTIONS.invoices()).doc("inv-led").get()).data() as { status: string }).status).toBe("void");
  });

  it("bounds: over-captured, fractional, and currency-conflicting refunds write NOTHING", async () => {
    const p = payment({ invoiceId: "inv-b" });
    await seedPayment(p);
    await db.collection(COLLECTIONS.invoices()).doc("inv-b").set({ id: "inv-b", status: "issued" });
    // seed one truthful partial (40000)
    await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_p1", providerRefundAmount: 40000, providerRefundStatus: "processed" }));
    // over-captured: 40000 + 70000 > 100000 -> hold, zero writes (never capped, never full)
    const r1 = await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_over", providerRefundAmount: 70000, providerRefundStatus: "processed" }));
    expect(r1.outcome).toBe("amount_mismatch");
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(40000);
    expect((pay.status as string)).toBe("partially_refunded");
    expect(((await db.collection(COLLECTIONS.invoices()).doc("inv-b").get()).data() as { status: string }).status).toBe("issued");
    // fractional paise -> held
    const r2 = await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_frac", providerRefundAmount: 100.5, providerRefundStatus: "processed" }));
    expect(r2.outcome).toBe("refund_pending");
    // currency conflict on the unrelated path -> fail closed
    const r3 = await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_cur", providerRefundAmount: 60000, providerRefundCurrency: "USD", providerRefundStatus: "processed" }));
    expect(r3.outcome).toBe("ownership_mismatch");
    // refund entity payment_id mismatch -> fail closed
    const r4 = await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_pid", providerRefundAmount: 60000, providerRefundPaymentId: "rzp_pay_OTHER", providerRefundStatus: "processed" }));
    expect(r4.outcome).toBe("ownership_mismatch");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(40000); // unchanged through all of it
    expect(((await db.collection(COLLECTIONS.invoices()).doc("inv-b").get()).data() as { status: string }).status).toBe("issued");
  });

  it("outbox-owned refund.processed ADOPTS the event's own evidence: reserved request projects with ZERO provider submissions, exact refund id preserved", async () => {
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    const p = payment();
    await seedPayment(p);
    // The request was never submitted (e.g. the post-commit drain crashed):
    // the provider-side refund exists and this event proves it processed.
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "reserved" });
    const before = mockProvider.initiateRefundCallCount;
    const r = await processProviderEvent(db, refundEvent(p, {
      eventType: "refund.processed", providerRefundReceipt: reqId,
      providerRefundId: "rfnd_drain", providerRefundAmount: 50000, providerRefundStatus: "processed",
    }));
    expect(r.outcome).toBe("outbox_owned"); // recorded owned, never generically projected
    // The evidence was adopted into the SAME request and projected - a blind
    // reserved->submit here would have created a SECOND provider refund.
    expect(mockProvider.initiateRefundCallCount).toBe(before); // ZERO submissions
    const req = (await db.collection(COLLECTIONS.refundRequests()).doc(reqId).get()).data() as Record<string, unknown>;
    expect(req.status).toBe("projected");
    expect(req.providerRefundId).toBe("rfnd_drain"); // the event's own refund, adopted
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded");
    expect(pay.refundAmount).toBe(50000);
    expect(pay.razorpayRefundId).toBe("rfnd_drain");
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).get();
    expect(ledger.size).toBe(1);
    expect(ledger.docs[0]!.data()).toMatchObject({ paymentId: p.id, providerRefundId: "rfnd_drain", source: "outbox", requestId: reqId, amountPaise: 50000 });
  });

  it("an event-driven drain NEVER submits unrelated reserved requests", async () => {
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    const p = payment();
    await seedPayment(p);
    const other = payment();
    await seedPayment(other);
    const reqA = await seedRequest(p, { amountPaise: 50000, status: "reserved" });
    const reqB = await seedRequest(other, { amountPaise: 70000, status: "reserved" });
    const r = await processProviderEvent(db, refundEvent(p, {
      eventType: "refund.processed", providerRefundReceipt: reqA,
      providerRefundId: "rfnd_a", providerRefundAmount: 50000, providerRefundStatus: "processed",
    }));
    expect(r.outcome).toBe("outbox_owned");
    // The bound request projected from its own evidence...
    expect((await db.collection(COLLECTIONS.refundRequests()).doc(reqA).get()).data()!.status).toBe("projected");
    // ...the UNRELATED reservation was never submitted by the event drain.
    const b = (await db.collection(COLLECTIONS.refundRequests()).doc(reqB).get()).data() as Record<string, unknown>;
    expect(b.status).toBe("reserved");
    expect(mockProvider.initiateRefundCallCount).toBe(0);
    const otherPay = (await db.collection(COLLECTIONS.payments()).doc(other.id).get()).data() as Payment;
    expect(otherPay.refundAmount ?? null).toBeNull();
  });

  it("duplicate redelivery of an owned processed event re-runs the drain idempotently: still counted ONCE", async () => {
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    const p = payment();
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "reserved" });
    const ev = refundEvent(p, {
      eventType: "refund.processed", providerRefundReceipt: reqId,
      providerRefundId: "rfnd_dup", providerRefundAmount: 50000, providerRefundStatus: "processed",
    });
    const r1 = await processProviderEvent(db, ev);
    expect(r1.outcome).toBe("outbox_owned");
    const r2 = await processProviderEvent(db, ev); // same event id redelivered
    expect(r2.outcome).toBe("duplicate");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(50000); // counted exactly once
    expect((await db.collection(COLLECTIONS.paymentRefunds()).get()).size).toBe(1);
    expect(mockProvider.initiateRefundCallCount).toBe(0);
  });

  it("legacy handler IN FLIGHT while the webhook projects the same refund: converges, never double-counts (barrier)", { timeout: 30000 }, async () => {
    const { initiateRefund } = await import("../../functions/payment/initiateRefund.js");
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    const p = payment({ bookingId: null, jobId: null });
    await seedPayment(p);
    // Hold the handler between provider-side acceptance and response delivery.
    let release!: () => void;
    let gated = false;
    mockProvider.beforeRefundResponse = async () => {
      gated = true;
      await new Promise<void>((res) => { release = res; });
    };
    const run = initiateRefund.run({ data: { paymentId: p.id, reason: "full" }, auth: { uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" } } as never);
    while (!gated) await new Promise((r) => setTimeout(r, 10));
    // The provider-side refund already exists (mock recorded it); its
    // processed event lands and projects BEFORE the handler resumes. The
    // mock's refund id is deterministic: mock_rfnd_<referenceId>.
    const ev = await processProviderEvent(db, refundEvent(p, {
      providerRefundId: `mock_rfnd_refund_${p.id}`, providerRefundAmount: 100000, providerRefundStatus: "processed",
    }));
    expect(ev.outcome).toBe("refunded");
    release!();
    const rr = (await run) as Record<string, unknown>;
    expect(rr.refunded).toBe(true);
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(100000); // the same money, counted exactly once
    expect(pay.status).toBe("refunded");
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).get();
    expect(ledger.size).toBe(1);
    expect(mockProvider.initiateRefundCallCount).toBe(1); // one provider refund exists
  });

  it("legacy handler IN FLIGHT while a PARTIAL webhook projection lands: HOLDS, never overwrites the partial (barrier)", { timeout: 30000 }, async () => {
    const { initiateRefund } = await import("../../functions/payment/initiateRefund.js");
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    const p = payment({ bookingId: null, jobId: null });
    await seedPayment(p);
    let release!: () => void;
    let gated = false;
    mockProvider.beforeRefundResponse = async () => {
      gated = true;
      await new Promise<void>((res) => { release = res; });
    };
    const run = initiateRefund.run({ data: { paymentId: p.id, reason: "full" }, auth: { uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" } } as never);
    while (!gated) await new Promise((r) => setTimeout(r, 10));
    // A DIFFERENT partial refund (40000) projects via the webhook mid-flight.
    const ev = await processProviderEvent(db, refundEvent(p, {
      providerRefundId: "rfnd_partial", providerRefundAmount: 40000, providerRefundStatus: "processed",
    }));
    expect(ev.outcome).toBe("refunded");
    release!();
    // The handler's full-refund projection must NOT overwrite the partial
    // accounting: it holds with its claim retained.
    await expect(run).rejects.toThrow();
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect((pay.status as string)).toBe("partially_refunded");
    expect(pay.refundAmount).toBe(40000); // untouched
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).get();
    expect(ledger.size).toBe(1);
    expect(ledger.docs[0]!.data()).toMatchObject({ providerRefundId: "rfnd_partial", source: "webhook" });
  });

  it("handler + webhook, both orders: the same money is never counted twice", async () => {
    // Webhook first (unrelated partial, 40000): legacy handler then REFUSES
    // (payment no longer 'completed') - no double count.
    const p = payment();
    await seedPayment(p);
    const r1 = await processProviderEvent(db, refundEvent(p, { providerRefundId: "rfnd_w1", providerRefundAmount: 40000, providerRefundStatus: "processed" }));
    expect(r1.outcome).toBe("refunded");
    const { initiateRefund } = await import("../../functions/payment/initiateRefund.js");
    await expect(initiateRefund.run({ data: { paymentId: p.id, reason: "second" }, auth: { uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" } } as never))
      .rejects.toThrow();
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(40000); // unchanged
    // Handler first (full refund via legacy path, mock provider): the same
    // refund's later webhook event is already_final, zero double count.
    const p2 = payment({ bookingId: null, jobId: null });
    await seedPayment(p2);
    const { mockProvider } = await import("../../lib/mock-payment-provider.js");
    mockProvider.loseNextRefundResponse = false;
    const rr = await initiateRefund.run({ data: { paymentId: p2.id, reason: "full" }, auth: { uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" } } as never);
    expect(rr).toMatchObject({ refunded: true });
    const r2 = await processProviderEvent(db, refundEvent(p2, { providerRefundId: "rfnd_leg", providerRefundAmount: 100000, providerRefundStatus: "processed" }));
    expect(r2.outcome).toBe("already_final");
    pay = (await db.collection(COLLECTIONS.payments()).doc(p2.id).get()).data() as Payment;
    expect(pay.refundAmount).toBe(100000); // exactly once
  });

  it("outbox-owned refund NEVER voids the invoice (accounting hold stays with the runner)", async () => {
    const p = payment({ invoiceId: "inv2" });
    await seedPayment(p);
    await db.collection(COLLECTIONS.invoices()).doc("inv2").set({ id: "inv2", status: "issued" });
    const reqId = await seedRequest(p, { amountPaise: 100000, status: "submitted", providerRefundId: "rfnd_x" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId, providerRefundAmount: 100000 }));
    expect(r.outcome).toBe("outbox_owned");
    const inv = (await db.collection(COLLECTIONS.invoices()).doc("inv2").get()).data() as { status: string };
    expect(inv.status).toBe("issued"); // untouched: the outbox projection NEVER voids (credit-note hold)
    // The owned refund DID project through the outbox's own truthful path
    // (full amount here) - the hold is about the invoice, not the money.
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(100000);
    expect(pay.invoiceReviewNeeded).toBe(true); // the hold is explicit on the payment
  });
});

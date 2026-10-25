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
  if (p.jobId) await db.collection(COLLECTIONS.jobs()).doc(p.jobId).set({ id: p.jobId, tenantId: p.tenantId, paymentStatus: "paid" });
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
  for (const col of [COLLECTIONS.payments(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentEvents(), COLLECTIONS.invoices(), COLLECTIONS.jobs(), COLLECTIONS.bookings()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("webhook refund.created outbox ownership", () => {
  it("webhook FIRST (reservation exists, not yet submitted): recorded as outbox_owned, zero payment writes", async () => {
    const p = payment();
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "reserved" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId }));
    expect(r.outcome).toBe("outbox_owned");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();
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

  it("refund.processed: outbox-owned stays owned; unrelated projects truthfully across partials", async () => {
    // Outbox-owned refund.processed: never generically projected.
    const p = payment();
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "submitted", providerRefundId: "rfnd_o" });
    const r = await processProviderEvent(db, refundEvent(p, { eventType: "refund.processed", providerRefundReceipt: reqId, providerRefundId: "rfnd_o", providerRefundAmount: 50000 }));
    expect(r.outcome).toBe("outbox_owned");
    let pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
    expect(pay.refundAmount ?? null).toBeNull();

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

  it("outbox-owned refund NEVER voids the invoice (accounting hold stays with the runner)", async () => {
    const p = payment({ invoiceId: "inv2" });
    await seedPayment(p);
    await db.collection(COLLECTIONS.invoices()).doc("inv2").set({ id: "inv2", status: "issued" });
    const reqId = await seedRequest(p, { amountPaise: 100000, status: "submitted", providerRefundId: "rfnd_x" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId, providerRefundAmount: 100000 }));
    expect(r.outcome).toBe("outbox_owned");
    const inv = (await db.collection(COLLECTIONS.invoices()).doc("inv2").get()).data() as { status: string };
    expect(inv.status).toBe("issued"); // untouched
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("completed");
  });
});

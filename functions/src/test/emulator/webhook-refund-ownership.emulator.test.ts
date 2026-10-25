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

  it("delayed webhook AFTER PARTIAL projection: payment partially_refunded -> ignored, never bumped to full", async () => {
    const p = payment({ status: "partially_refunded" as never, refundAmount: 50000, razorpayRefundId: "rfnd_p" });
    await seedPayment(p);
    const reqId = await seedRequest(p, { amountPaise: 50000, status: "projected", providerRefundId: "rfnd_p" });
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId, providerRefundId: "rfnd_p" }));
    expect(r.outcome).toBe("ignored");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("partially_refunded");
    expect(pay.refundAmount).toBe(50000);
  });

  it("binding rejects look-alikes: wrong payment, wrong amount, or wrong currency fall through to generic projection", async () => {
    const p = payment();
    await seedPayment(p);
    const other = payment();
    await seedPayment(other);
    const reqId = await seedRequest(other, { amountPaise: 50000, status: "submitted", providerRefundId: "rfnd_x" });
    // Same receipt exists but belongs to ANOTHER payment -> NOT owned -> generic projection.
    const r = await processProviderEvent(db, refundEvent(p, { providerRefundReceipt: reqId }));
    expect(r.outcome).toBe("refunded");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    // Amount mismatch: a request on THIS payment but for a different amount is not the owner.
    const p2 = payment();
    await seedPayment(p2);
    const req2 = await seedRequest(p2, { amountPaise: 30000, status: "submitted" });
    const r2 = await processProviderEvent(db, refundEvent(p2, { providerRefundReceipt: req2, providerRefundAmount: 50000 }));
    expect(r2.outcome).toBe("refunded");
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

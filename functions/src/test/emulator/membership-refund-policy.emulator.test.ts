/**
 * Owner policy 30 Oct 2026 (Meet, iMessage): membership refunds are always FULL,
 * and a full refund stops that membership's benefits. Emulator proof over the
 * unrelated (dashboard) refund path and its guardrails:
 *  - full refund cancels the payment's OWN membership (active or pending)
 *  - partial refund (not offered) leaves the membership and alerts staff
 *  - upgrade refund never touches the ended predecessor or any other membership
 *  - booking/job refunds carry no membership side effects
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

function membershipPayment(mid: string, o: Record<string, unknown> = {}): Payment {
  return {
    id: uid("pay"), tenantId: "t1", studioId: null, targetType: "membership", jobId: null, bookingId: null,
    membershipId: mid, giftId: null, customerId: "c1", amount: 29900, currency: "INR",
    method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: uid("rzp_pay"), razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o,
  } as Payment;
}

function refundEvent(p: Payment, amount: number, o: Partial<ProviderWebhookEvent> = {}): ProviderWebhookEvent {
  return {
    eventType: "refund.processed", providerEventId: uid("evt"), providerPaymentId: p.razorpayPaymentId!,
    providerPaymentLinkId: "pl1", providerRefundId: uid("rfnd"), referenceId: p.id,
    amount, currency: "INR",
    providerRefundAmount: amount, providerRefundCurrency: "INR", providerRefundReceipt: null,
    providerRefundPaymentId: p.razorpayPaymentId ?? null, providerRefundStatus: "processed",
    ...o,
  } as ProviderWebhookEvent;
}

async function seedMembership(id: string, status: string, extra: Record<string, unknown> = {}) {
  await db.collection(COLLECTIONS.memberships()).doc(id).set({ id, tenantId: "t1", customerId: "c1", status, ...extra });
}
const membership = async (id: string) => (await db.collection(COLLECTIONS.memberships()).doc(id).get()).data() as Record<string, unknown>;
const audits = async (entityId: string) =>
  (await db.collection(COLLECTIONS.auditLog()).where("entityId", "==", entityId).get()).docs.map((d) => d.data());

beforeEach(async () => {
  for (const col of [COLLECTIONS.payments(), COLLECTIONS.memberships(), COLLECTIONS.paymentRefunds(), COLLECTIONS.paymentEvents(), COLLECTIONS.staffAlerts(), COLLECTIONS.auditLog(), COLLECTIONS.jobs(), COLLECTIONS.bookings()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("membership refund policy (full-only, deactivates)", () => {
  it("full refund of an ACTIVE membership's payment cancels that membership with audit", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const r = await processProviderEvent(db, refundEvent(p, 29900));
    expect(r.outcome).toBe("refunded");
    const m = await membership(mid);
    expect(m.status).toBe("cancelled");
    expect(m.cancellationReason).toBe(`refunded:${p.id}`);
    expect(m.cancelledBy).toBe("system");
    const a = await audits(mid);
    expect(a.some((x) => x["action"] === "membership.cancelled" && (x["after"] as Record<string, unknown>)["reason"] === "payment_refunded")).toBe(true);
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!.status).toBe("refunded");
  });

  it("full refund of a PENDING membership's payment cancels it - it must never activate later", async () => {
    const mid = uid("m");
    await seedMembership(mid, "pending");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(mid)).status).toBe("cancelled");
  });

  it("partial refund (not offered for memberships) leaves the membership active and alerts staff", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 10000))).outcome).toBe("refunded");
    expect((await membership(mid)).status).toBe("active");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status as string).toBe("partially_refunded");
    const alert = (await db.collection(COLLECTIONS.staffAlerts()).doc(`membership_partial_refund_${p.id}`).get()).data();
    expect(alert?.["kind"]).toBe("membership_partial_refund");
  });

  it("upgrade refund cancels the new membership and leaves the ended predecessor exactly as it was", async () => {
    const oldMid = uid("m"), newMid = uid("m");
    await seedMembership(oldMid, "cancelled", { cancellationReason: `upgraded_to:${newMid}`, cancelledAt: new Date().toISOString() });
    await seedMembership(newMid, "active", { upgradeFromMembershipId: oldMid });
    const p = membershipPayment(newMid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(newMid)).status).toBe("cancelled");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("cancelled");
    expect(oldM.cancellationReason).toBe(`upgraded_to:${newMid}`); // never restored, never re-touched
    expect((await audits(oldMid)).length).toBe(0);
  });

  it("another active membership of the same customer (different payment) is untouched", async () => {
    const otherMid = uid("m"), thisMid = uid("m");
    await seedMembership(otherMid, "active");
    await seedMembership(thisMid, "active");
    const p = membershipPayment(thisMid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(thisMid)).status).toBe("cancelled");
    expect((await membership(otherMid)).status).toBe("active");
    expect((await audits(otherMid)).length).toBe(0);
  });

  it("full refund of a JOB payment carries no membership side effects (booking refunds unchanged)", async () => {
    const p = membershipPayment("ignored", { targetType: "job", membershipId: null, jobId: uid("job"), bookingId: uid("b"), amount: 100000 });
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).set({ id: p.jobId, tenantId: "t1", bookingId: p.bookingId, paymentStatus: "paid" });
    await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).set({ id: p.bookingId, tenantId: "t1", paymentStatus: "paid" });
    expect((await processProviderEvent(db, refundEvent(p, 100000))).outcome).toBe("refunded");
    expect((await db.collection(COLLECTIONS.memberships()).get()).size).toBe(0);
    expect((await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).get()).data()!["paymentStatus"]).toBe("refunded");
    expect((await db.collection(COLLECTIONS.staffAlerts()).get()).size).toBe(0);
  });

  it("already-ended membership + full refund: payment projects, no membership rewrite", async () => {
    const mid = uid("m");
    await seedMembership(mid, "expired", { endDate: "2026-10-01" });
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    const m = await membership(mid);
    expect(m.status).toBe("expired"); // untouched
    expect(m.cancellationReason ?? null).toBeNull();
  });
});

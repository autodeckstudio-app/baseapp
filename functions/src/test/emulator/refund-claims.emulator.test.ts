/**
 * Legacy retained-claim reconciliation (review: retained claims must not
 * strand staff). Proves the reconciliation-ONLY path: bound provider
 * evidence -> project truthful processed money / release on authoritative
 * absence / hold visibly on unknown, pending, or mismatch - and NEVER a new
 * refund submission (provider initiateRefund call count stays at zero
 * across every scenario).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

process.env["USE_PAYMENT_MOCK"] = "true";

import { reconcileLegacyRefundClaim, reconcileLegacyRefundClaims } from "../../lib/refund-claims.js";
import { mockProvider } from "../../lib/mock-payment-provider.js";
import { initiateRefund } from "../../functions/payment/initiateRefund.js";
import { reconcileRefundClaims } from "../../functions/payment/reconcileRefundClaims.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const actor = { uid: "reconciler", displayName: null, phone: null, email: null, claims: { role: "admin", tenantId: "t1", studioId: null } } as never;
const adminAuth = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "t" });

function payment(o: Record<string, unknown> = {}): Payment {
  return {
    id: uid("pay"), tenantId: "t1", studioId: "s1", targetType: "job", jobId: uid("job"), bookingId: uid("b"),
    membershipId: null, customerId: "c1", amount: 100000, currency: "INR",
    method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: uid("rzp_pay"), razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o,
  };
}

async function seed(p: Payment, withInvoice = false) {
  await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
  if (p.jobId) await db.collection(COLLECTIONS.jobs()).doc(p.jobId).set({ id: p.jobId, tenantId: p.tenantId, bookingId: p.bookingId, paymentStatus: "paid" });
  if (p.bookingId) await db.collection(COLLECTIONS.bookings()).doc(p.bookingId).set({ id: p.bookingId, tenantId: p.tenantId, paymentStatus: "paid" });
  if (withInvoice && p.invoiceId) await db.collection(COLLECTIONS.invoices()).doc(p.invoiceId).set({ id: p.invoiceId, tenantId: p.tenantId, status: "paid" });
}

async function plantClaim(paymentId: string) {
  await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${paymentId}`).set({ paymentId, claimedAt: new Date().toISOString(), claimedBy: "a1" });
}

/** Plant provider-side refund state for the claim's reference id (this is the
 * TEST seeding the mock provider; the reconciler itself never calls it). */
async function plantProviderRefund(p: Payment, status: string, amountOverride?: number) {
  mockProvider.nextRefundStatus = status;
  const r = await mockProvider.initiateRefund({
    providerPaymentId: p.razorpayPaymentId!, amount: amountOverride ?? p.amount,
    reason: "planted", referenceId: `refund_${p.id}`,
  });
  return r.providerRefundId;
}

beforeEach(async () => {
  for (const col of [COLLECTIONS.payments(), COLLECTIONS.jobs(), COLLECTIONS.bookings(), COLLECTIONS.invoices(), COLLECTIONS.paymentEvents(), COLLECTIONS.paymentRefunds()]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("legacy retained-claim reconciliation", () => {
  it("unknown provider outcome: held with a visible note, claim retained, zero financial writes, no submission", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    const calls = mockProvider.initiateRefundCallCount;
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    expect(mockProvider.initiateRefundCallCount).toBe(calls);
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.reconcileState).toBe("held");
    expect(claim.reconcileNote).toContain("unknown");
    const after = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!;
    expect(after.status).toBe("completed");
    expect(after.refundAmount ?? null).toBeNull();
    expect((await db.collection(COLLECTIONS.paymentRefunds()).get()).size).toBe(0);
  });

  it("provider reports the refund pending: held, nothing projected", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "pending");
    const calls = mockProvider.initiateRefundCallCount;
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    expect(mockProvider.initiateRefundCallCount).toBe(calls);
    expect(((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!).status).toBe("completed");
    expect((await db.collection(COLLECTIONS.paymentRefunds()).get()).size).toBe(0);
  });

  it("provider confirms processed: projected truthfully (payment, ledger, invoice void, job/booking sync), claim resolved", async () => {
    const p = payment({ invoiceId: uid("inv") });
    await seed(p, true);
    await plantClaim(p.id);
    const rfnd = await plantProviderRefund(p, "processed");
    const calls = mockProvider.initiateRefundCallCount;
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("projected");
    expect(mockProvider.initiateRefundCallCount).toBe(calls);
    const after = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!;
    expect(after.status).toBe("refunded");
    expect(after.refundAmount).toBe(100000);
    expect(after.razorpayRefundId).toBe(rfnd);
    expect(((await db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${p.id}_${rfnd}`).get()).data()!).source).toBe("legacy");
    expect(((await db.collection(COLLECTIONS.invoices()).doc(p.invoiceId!).get()).data()!).status).toBe("void");
    expect(((await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).get()).data()!).paymentStatus).toBe("refunded");
    expect(((await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).get()).data()!).paymentStatus).toBe("refunded");
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.reconcileState).toBe("resolved");
    expect(claim.providerRefundId).toBe(rfnd);
  });

  it("binding mismatch (provider refund amount differs): held as unknown, zero writes", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed", 50000); // different amount than bound 100000
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    expect(((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!).status).toBe("completed");
    expect((await db.collection(COLLECTIONS.paymentRefunds()).get()).size).toBe(0);
  });

  it("duplicate accounting for the same provider refund: converges, never double-counts", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    const rfnd = await plantProviderRefund(p, "processed");
    // Another path already accounted this exact provider refund.
    await db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${p.id}_${rfnd}`).set({
      paymentId: p.id, providerRefundId: rfnd, amountPaise: p.amount, currency: p.currency, source: "webhook", createdAt: new Date().toISOString(),
    });
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("converged");
    expect((await db.collection(COLLECTIONS.paymentRefunds()).get()).size).toBe(1);
  });

  it("concurrent reconciliation of the same claim: exactly one projection, one ledger entry", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    const rfnd = await plantProviderRefund(p, "processed");
    const [o1, o2] = await Promise.all([
      reconcileLegacyRefundClaim(db, mockProvider, p.id, actor),
      reconcileLegacyRefundClaim(db, mockProvider, p.id, actor),
    ]);
    expect([o1, o2].sort()).toEqual(["converged", "projected"]);
    expect((await db.collection(COLLECTIONS.paymentRefunds()).get()).size).toBe(1);
    const after = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!;
    expect(after.status).toBe("refunded");
    expect(after.razorpayRefundId).toBe(rfnd);
  });

  it("authoritative absence releases the claim; a genuine retry then succeeds end to end", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    mockProvider.authoritativeNegatives = true;
    try {
      const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
      expect(outcome).toBe("released_absent");
      expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).exists).toBe(false);
      // Un-stranded: the same legacy path can now be used again.
      const r = (await initiateRefund.run({ data: { paymentId: p.id, reason: "genuine retry" }, auth: adminAuth() } as never)) as { refunded: boolean };
      expect(r.refunded).toBe(true);
    } finally {
      mockProvider.authoritativeNegatives = false;
    }
  });

  it("sweep is tenant-scoped and counts outcomes; another tenant's claim is untouched", async () => {
    const mine = payment();
    const other = payment({ tenantId: "t2" });
    await seed(mine);
    await seed(other);
    await plantClaim(mine.id);
    await plantClaim(other.id);
    await plantProviderRefund(mine, "processed");
    await plantProviderRefund(other, "processed");
    const counts = await reconcileLegacyRefundClaims(db, mockProvider, { tenantId: "t1", actor });
    expect(counts.projected).toBe(1);
    expect(((await db.collection(COLLECTIONS.payments()).doc(mine.id).get()).data()!).status).toBe("refunded");
    // Other tenant: claim and payment untouched.
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${other.id}`).get()).exists).toBe(true);
    expect(((await db.collection(COLLECTIONS.payments()).doc(other.id).get()).data()!).status).toBe("completed");
  });

  it("callable: non-admin is denied", async () => {
    await expect(reconcileRefundClaims.run({ data: {}, auth: { uid: "c1", token: { role: "customer", tenantId: "t1" }, rawToken: "t" } } as never))
      .rejects.toThrow(/Admin role/);
  });
});

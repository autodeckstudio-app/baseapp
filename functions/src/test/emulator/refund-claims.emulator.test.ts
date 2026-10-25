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
import { listRefundWork } from "../../functions/payment/listRefundWork.js";

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
  if (withInvoice && p.invoiceId) await db.collection(COLLECTIONS.invoices()).doc(p.invoiceId).set({ id: p.invoiceId, tenantId: p.tenantId, status: "paid", jobId: p.jobId, bookingId: p.bookingId, paymentId: p.id });
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
    // Both interleavings are safe: the loser either converges on the winner's
    // ledger entry, or its projection sees the claim already resolved by the
    // winner and holds with zero writes. The invariant is exactly one
    // projection, one ledger entry, and the claim ends resolved.
    expect([o1, o2].sort()[1]).toBe("projected");
    expect(["converged", "held"]).toContain([o1, o2].sort()[0]);
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

describe("reconciliation hardening (review findings)", () => {
  it("partial/other ledger rows do NOT resolve a full claim: held and visible", async () => {
    const p = payment({ status: "refunded", refundAmount: 50000, refundedAt: new Date().toISOString() });
    await seed(p);
    await plantClaim(p.id);
    await db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${p.id}_rfnd_partial`).set({
      paymentId: p.id, providerRefundId: "rfnd_partial", amountPaise: 50000, currency: "INR", source: "outbox", createdAt: new Date().toISOString(),
    });
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.reconcileState).toBe("held");
    expect(claim.reconcileNote).toContain("partial/unbound ledger");
  });

  it("conflicting ledger row (wrong currency) holds instead of resolving", async () => {
    const p = payment({ status: "refunded", refundAmount: 100000, refundedAt: new Date().toISOString() });
    await seed(p);
    await plantClaim(p.id);
    await db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${p.id}_rfnd_conf`).set({
      paymentId: p.id, providerRefundId: "rfnd_conf", amountPaise: 100000, currency: "USD", source: "outbox", createdAt: new Date().toISOString(),
    });
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.reconcileState).toBe("held");
    expect(claim.reconcileNote).toContain("conflicts");
  });

  it("release/newclaim race: a released-then-recreated claim is never deleted or annotated by the stale pass", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    mockProvider.authoritativeNegatives = true;
    const orig = mockProvider.findRefundByReference.bind(mockProvider);
    mockProvider.findRefundByReference = async (ref: string, binding: never) => {
      const r = await orig(ref, binding);
      // A fresh refund attempt lands between the lookup and the release:
      // old claim released, NEW claim created (new claimedAt generation).
      const c = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`);
      const prevClaimedAt = (await c.get()).data()!.claimedAt;
      await c.delete();
      // SAME claimedAt as the released generation: claimedAt alone must not
      // authorize the stale release; only the exact doc generation does.
      await c.set({ paymentId: p.id, claimedAt: prevClaimedAt, claimedBy: "a2" });
      return r;
    };
    try {
      const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
      expect(outcome).toBe("held");
    } finally {
      mockProvider.findRefundByReference = orig;
      mockProvider.authoritativeNegatives = false;
    }
    const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
    expect(claim.exists).toBe(true);
    expect(claim.data()!.claimedBy).toBe("a2");
    expect(claim.data()!.reconcileState).toBeUndefined();
    expect(claim.data()!.reconcileNote).toBeUndefined();
  });

  it("annotate never recreates a claim released mid-flight", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    const orig = mockProvider.findRefundByReference.bind(mockProvider);
    mockProvider.findRefundByReference = async (ref: string, binding: never) => {
      const r = await orig(ref, binding);
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).delete();
      return r;
    };
    try {
      await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    } finally {
      mockProvider.findRefundByReference = orig;
    }
    const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
    expect(claim.exists).toBe(false);
  });

  it("sweep paginates past 130 foreign claims instead of starving the tenant's unresolved row", async () => {
    for (let i = 0; i < 130; i++) {
      const fp = payment({ id: `fa${String(i).padStart(4, "0")}`, tenantId: "t2" });
      await db.collection(COLLECTIONS.payments()).doc(fp.id).set(fp);
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${fp.id}`).set({ paymentId: fp.id, claimedAt: new Date().toISOString(), claimedBy: "x" });
    }
    const p = payment({ id: "zz-target" });
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    const planted = mockProvider.initiateRefundCallCount;
    const counts = await reconcileLegacyRefundClaims(db, mockProvider, { tenantId: "t1", limit: 1, maxScan: 500, actor });
    expect(counts.projected).toBe(1);
    expect(mockProvider.initiateRefundCallCount).toBe(planted);
  });

  it("linked doc tenant mismatch: held with zero financial writes", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).set({ id: p.jobId, tenantId: "t2", bookingId: p.bookingId, paymentStatus: "paid" });
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    const fresh = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(fresh.status).toBe("completed");
    expect(fresh.refundAmount ?? 0).toBe(0);
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).where("paymentId", "==", p.id).get();
    expect(ledger.empty).toBe(true);
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.reconcileState).toBe("held");
  });
});


describe("reconciliation adversarial invariants (review round 2)", () => {
  it("payment binding mutated during blocked lookup: no stale release", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    mockProvider.authoritativeNegatives = true;
    const orig = mockProvider.findRefundByReference.bind(mockProvider);
    mockProvider.findRefundByReference = async (ref: string, binding: never) => {
      const r = await orig(ref, binding);
      await db.collection(COLLECTIONS.payments()).doc(p.id).update({ amount: 999 });
      return r;
    };
    try {
      const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
      expect(outcome).toBe("held");
    } finally {
      mockProvider.findRefundByReference = orig;
      mockProvider.authoritativeNegatives = false;
    }
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).exists).toBe(true);
  });

  it("claim recreated with same claimedAt during blocked lookup: no stale projection", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    const orig = mockProvider.findRefundByReference.bind(mockProvider);
    mockProvider.findRefundByReference = async (ref: string, binding: never) => {
      const r = await orig(ref, binding);
      const c = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`);
      const prevClaimedAt = (await c.get()).data()!.claimedAt;
      await c.delete();
      await c.set({ paymentId: p.id, claimedAt: prevClaimedAt, claimedBy: "a2" });
      return r;
    };
    try {
      const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
      expect(outcome).toBe("held");
    } finally {
      mockProvider.findRefundByReference = orig;
    }
    const fresh = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(fresh.status).toBe("completed");
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).where("paymentId", "==", p.id).get();
    expect(ledger.empty).toBe(true);
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.claimedBy).toBe("a2");
    expect(claim.reconcileState).toBeUndefined();
  });

  it("sweep converges across passes beyond the 500-scan bound (persisted cursor)", { timeout: 30000 }, async () => {
    for (let i = 0; i < 600; i++) {
      const fid = `fb${String(i).padStart(4, "0")}`;
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${fid}`).set({ paymentId: fid, tenantId: "t2", claimedAt: new Date().toISOString(), claimedBy: "x" });
    }
    const p = payment({ id: "zz-target2" });
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    const first = await reconcileLegacyRefundClaims(db, mockProvider, { tenantId: "t1", limit: 5, maxScan: 500, actor });
    expect(first.projected).toBe(0);
    expect(first.exhausted).toBe(false);
    const second = await reconcileLegacyRefundClaims(db, mockProvider, { tenantId: "t1", limit: 5, maxScan: 500, actor });
    expect(second.projected).toBe(1);
    expect(second.exhausted).toBe(true);
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!.status).toBe("refunded");
  });

  it("same-tenant job with wrong booking linkage: held, zero financial writes", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).update({ bookingId: "some-other-booking" });
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    const fresh = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(fresh.status).toBe("completed");
    const job = (await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).get()).data()!;
    expect(job.paymentStatus).toBe("paid");
    const ledger = await db.collection(COLLECTIONS.paymentRefunds()).where("paymentId", "==", p.id).get();
    expect(ledger.empty).toBe(true);
  });

  it("missing invoice with invoiceId set: held, zero financial writes", async () => {
    const p = payment({ invoiceId: uid("inv") });
    await seed(p);
    await plantClaim(p.id);
    await plantProviderRefund(p, "processed");
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    const fresh = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(fresh.status).toBe("completed");
  });

  it("list discovery converges across calls beyond the scan bound (persisted cursor + backfill)", async () => {
    for (let i = 0; i < 600; i++) {
      const fid = `fc${String(i).padStart(4, "0")}`;
      await db.collection(COLLECTIONS.payments()).doc(fid).set(payment({ id: fid, tenantId: "t2" }));
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${fid}`).set({ paymentId: fid, claimedAt: new Date().toISOString(), claimedBy: "x" });
    }
    const p = payment({ id: "zz-listtarget" });
    await seed(p);
    await plantClaim(p.id);
    const auth = adminAuth();
    const first = (await listRefundWork.run({ data: {}, auth } as never)) as { legacyClaims: { paymentId: string }[] };
    expect(first.legacyClaims.some((c) => c.paymentId === p.id)).toBe(false);
    const second = (await listRefundWork.run({ data: {}, auth } as never)) as { legacyClaims: { paymentId: string }[] };
    expect(second.legacyClaims.some((c) => c.paymentId === p.id)).toBe(true);
  });

  it("full-coverage ledger row from a DIFFERENT refund reference without provider confirmation: held, not resolved", async () => {
    const p = payment({ status: "refunded", refundAmount: 100000, refundedAt: new Date().toISOString() });
    await seed(p);
    await plantClaim(p.id);
    await db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${p.id}_rfnd_other`).set({
      paymentId: p.id, providerRefundId: "rfnd_other", amountPaise: 100000, currency: "INR", source: "outbox", createdAt: new Date().toISOString(),
    });
    // Provider has no record of THIS claim's reference and payment has no
    // razorpayRefundId recorded: full coverage alone must not resolve.
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    const claim = (await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!;
    expect(claim.reconcileState).toBe("held");
  });
});

describe("reconciliation adversarial invariants (review round 3)", () => {
  it("two-pass pending->held->processed on the SAME claim generation projects", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    // pass 1: provider has nothing -> unknown -> held
    const first = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(first).toBe("held");
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!.reconcileState).toBe("held");
    // provider later confirms processed
    await plantProviderRefund(p, "processed");
    const second = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(second).toBe("projected");
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!.status).toBe("refunded");
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!.reconcileState).toBe("resolved");
  });

  it("sweep persists last-VISITED doc: 25 eligible claims, limit 20, two passes visit all", async () => {
    for (let i = 0; i < 25; i++) {
      const tp = payment({ id: `t25-${String(i).padStart(3, "0")}` });
      await seed(tp);
      await plantClaim(tp.id);
      await plantProviderRefund(tp, "processed");
    }
    const first = await reconcileLegacyRefundClaims(db, mockProvider, { tenantId: "t1", limit: 20, maxScan: 500, actor });
    expect(first.projected).toBe(20);
    const second = await reconcileLegacyRefundClaims(db, mockProvider, { tenantId: "t1", limit: 20, maxScan: 500, actor });
    expect(second.projected).toBe(5);
    for (let i = 0; i < 25; i++) {
      expect((await db.collection(COLLECTIONS.payments()).doc(`t25-${String(i).padStart(3, "0")}`).get()).data()!.status).toBe("refunded");
    }
  });

  it("list fast path: 60 resolved backfilled claims cannot hide a later unresolved backfilled claim", async () => {
    for (let i = 0; i < 60; i++) {
      const rid = `res-${String(i).padStart(3, "0")}`;
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${rid}`).set({
        paymentId: rid, tenantId: "t1", claimedAt: new Date().toISOString(), claimedBy: "x",
        reconcileState: "resolved", reconcileNote: "done",
      });
    }
    const p = payment({ id: "zz-unresolved" });
    await seed(p);
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).set({
      paymentId: p.id, tenantId: "t1", claimedAt: new Date().toISOString(), claimedBy: "a1", reconcileState: "held", reconcileNote: "pending",
    });
    const r = (await listRefundWork.run({ data: {}, auth: adminAuth() } as never)) as { legacyClaims: { paymentId: string }[]; legacyScanComplete: boolean };
    expect(r.legacyClaims.some((c) => c.paymentId === p.id)).toBe(true);
  });

  it("payment's own refundId with OUTBOX-source ledger and no provider evidence for this reference: held, not resolved", async () => {
    const p = payment({ status: "refunded", refundAmount: 100000, refundedAt: new Date().toISOString(), razorpayRefundId: "rfnd_outbox1" });
    await seed(p);
    await plantClaim(p.id);
    await db.collection(COLLECTIONS.paymentRefunds()).doc(`pr_${p.id}_rfnd_outbox1`).set({
      paymentId: p.id, providerRefundId: "rfnd_outbox1", amountPaise: 100000, currency: "INR", source: "outbox", createdAt: new Date().toISOString(),
    });
    const outcome = await reconcileLegacyRefundClaim(db, mockProvider, p.id, actor);
    expect(outcome).toBe("held");
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).data()!.reconcileState).toBe("held");
  });

  it("backfill never resurrects a claim released concurrently with listing", async () => {
    const p = payment();
    await seed(p);
    await plantClaim(p.id);
    // release the claim before listing: discovery must not recreate it
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).delete();
    await listRefundWork.run({ data: {}, auth: adminAuth() } as never);
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get()).exists).toBe(false);
  });
});

describe("reconciliation adversarial invariants (review round 4)", () => {
  it("list converges across calls past 600 resolved backfilled claims (persisted fast-path cursor)", { timeout: 30000 }, async () => {
    for (let i = 0; i < 600; i++) {
      const rid = `rs-${String(i).padStart(4, "0")}`;
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${rid}`).set({
        paymentId: rid, tenantId: "t1", claimedAt: new Date().toISOString(), claimedBy: "x",
        reconcileState: "resolved", reconcileNote: "done",
      });
    }
    const p = payment({ id: "zz-fasttarget" });
    await seed(p);
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).set({
      paymentId: p.id, tenantId: "t1", claimedAt: new Date().toISOString(), claimedBy: "a1", reconcileState: "held", reconcileNote: "pending",
    });
    const auth = adminAuth();
    const first = (await listRefundWork.run({ data: {}, auth } as never)) as { legacyClaims: { paymentId: string }[]; legacyScanComplete: boolean };
    expect(first.legacyClaims.some((c) => c.paymentId === p.id)).toBe(false);
    expect(first.legacyScanComplete).toBe(false);
    const second = (await listRefundWork.run({ data: {}, auth } as never)) as { legacyClaims: { paymentId: string }[]; legacyScanComplete: boolean };
    expect(second.legacyClaims.some((c) => c.paymentId === p.id)).toBe(true);
  });

  it("list cap boundary: 150 unresolved claims paginate distinctly across calls, no repeats, then completes", async () => {
    for (let i = 0; i < 150; i++) {
      const tp = payment({ id: `cap-${String(i).padStart(4, "0")}` });
      await db.collection(COLLECTIONS.payments()).doc(tp.id).set(tp);
      await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${tp.id}`).set({
        paymentId: tp.id, tenantId: "t1", claimedAt: new Date().toISOString(), claimedBy: "x", reconcileState: "held", reconcileNote: "pending",
      });
    }
    const auth = adminAuth();
    const seen: string[] = [];
    let lastComplete = false;
    for (let call = 0; call < 4; call++) {
      const r = (await listRefundWork.run({ data: {}, auth } as never)) as { legacyClaims: { paymentId: string }[]; legacyScanComplete: boolean };
      lastComplete = r.legacyScanComplete;
      for (const c of r.legacyClaims) {
        expect(seen).not.toContain(c.paymentId); // no repeats across calls
        seen.push(c.paymentId);
      }
      if (r.legacyScanComplete) break;
    }
    expect(seen.length).toBe(150);
    expect(lastComplete).toBe(true);
  });

  it("concurrent release/recreate pinned exactly between discovery read and backfill write (barrier)", async () => {
    const p = payment({ id: "zz-racetarget" });
    await seed(p);
    await plantClaim(p.id);

    // Barrier: the swap (claim delete + recreate as a new generation, payment
    // removed) is pinned EXACTLY between the discovery pass's non-transactional
    // payment read and the start of the backfill transaction. The patched
    // payment get returns the pre-swap (stale) snapshot; the backfill
    // transaction must then reread the claim, see the NEW generation
    // (updateTime differs even with the same claimedAt), find no fresh
    // payment binding, and abstain.
    let armed = true;
    const origCollection = db.collection.bind(db);
    const doSwap = async () => {
      const c = db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`);
      const prev = (await c.get()).data()!.claimedAt;
      await c.delete();
      await c.set({ paymentId: p.id, claimedAt: prev, claimedBy: "a2" });
      await origCollection(COLLECTIONS.payments()).doc(p.id).delete();
    };
    (db as unknown as { collection: unknown }).collection = (path: string) => {
      const col = origCollection(path);
      if (path !== COLLECTIONS.payments()) return col;
      const origDoc = col.doc.bind(col);
      (col as { doc: unknown }).doc = (id: string) => {
        const ref = origDoc(id);
        if (id !== p.id || !armed) return ref;
        const origGet = ref.get.bind(ref);
        (ref as { get: unknown }).get = async () => {
          const snap = await origGet();
          if (armed) {
            armed = false;
            await doSwap(); // pinned between the read result and the write
          }
          return snap;
        };
        return ref;
      };
      return col;
    };
    try {
      await listRefundWork.run({ data: {}, auth: adminAuth() } as never);
    } finally {
      (db as unknown as { collection: unknown }).collection = origCollection;
    }
    expect(armed).toBe(false); // the barrier actually fired at the boundary
    const claim = await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).get();
    expect(claim.exists).toBe(true);
    expect(claim.data()!.claimedBy).toBe("a2");
    expect(claim.data()!.tenantId).toBeUndefined();
  });

  
});

describe("claimTruth authoritative refresh (review round 7)", () => {
  const listTruth = async (ids: string[]) =>
    ((await listRefundWork.run({ data: { knownClaimPaymentIds: ids }, auth: adminAuth() } as never)) as {
      claimTruth: { paymentId: string; state: string; note: string | null }[];
    }).claimTruth;

  it("held row becomes resolved after an actual reconcile; released claim reports released; still-held remains", async () => {
    const p1 = payment();
    await seed(p1);
    await plantClaim(p1.id);
    const p2 = payment();
    await seed(p2);
    await plantClaim(p2.id);
    mockProvider.authoritativeNegatives = true;

    let truth = await listTruth([p1.id, p2.id]);
    expect(truth.find((t) => t.paymentId === p1.id)?.state).toBe("retained");
    expect(truth.find((t) => t.paymentId === p2.id)?.state).toBe("retained");

    // p1: provider confirms processed -> projected -> resolved
    mockProvider.authoritativeNegatives = false;
    await plantProviderRefund(p1, "processed");
    expect(await reconcileLegacyRefundClaim(db, mockProvider, p1.id, actor)).toBe("projected");
    // p2: provider authoritatively has no record -> released
    mockProvider.authoritativeNegatives = true;
    expect(await reconcileLegacyRefundClaim(db, mockProvider, p2.id, actor)).toBe("released_absent");
    mockProvider.authoritativeNegatives = false;

    truth = await listTruth([p1.id, p2.id]);
    expect(truth.find((t) => t.paymentId === p1.id)?.state).toBe("resolved");
    expect(truth.find((t) => t.paymentId === p2.id)?.state).toBe("released");

    // a still-held claim remains held with its note
    const p3 = payment();
    await seed(p3);
    await plantClaim(p3.id);
    await reconcileLegacyRefundClaim(db, mockProvider, p3.id, actor); // unknown -> held
    truth = await listTruth([p3.id]);
    expect(truth[0]?.state).toBe("held");
    expect(truth[0]?.note).toContain("provider outcome");
  });

  it("never leaks another tenant's claim truth", async () => {
    const other = payment({ tenantId: "t2" });
    await db.collection(COLLECTIONS.payments()).doc(other.id).set(other);
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${other.id}`).set({ paymentId: other.id, tenantId: "t2", claimedAt: new Date().toISOString(), claimedBy: "x" });
    const truth = await listTruth([other.id]);
    expect(truth).toHaveLength(0);
  });
});

describe("claimTruth tenant verification (review round 8)", () => {
  const listTruth = async (ids: string[]) =>
    ((await listRefundWork.run({ data: { knownClaimPaymentIds: ids }, auth: adminAuth() } as never)) as {
      claimTruth: { paymentId: string; state: string }[];
    }).claimTruth;

  it("absent claim is only 'released' when the owning payment verifiably belongs to the tenant", async () => {
    const foreign = payment({ tenantId: "t2" });
    await db.collection(COLLECTIONS.payments()).doc(foreign.id).set(foreign);
    const own = payment();
    await seed(own);
    const ghost = payment(); // no payment doc at all
    const truth = await listTruth([foreign.id, own.id, ghost.id]);
    // foreign: omitted (no oracle); ghost: omitted; own absent claim: released
    expect(truth.map((t) => t.paymentId)).toEqual([own.id]);
    expect(truth[0]?.state).toBe("released");
  });

  it("stale stored claim tenantId does not leak when the current payment moved tenants", async () => {
    const p = payment();
    await seed(p);
    await db.collection(COLLECTIONS.paymentEvents()).doc(`refund_${p.id}`).set({
      paymentId: p.id, tenantId: "t1", claimedAt: new Date().toISOString(), claimedBy: "x", reconcileState: "held", reconcileNote: "pending",
    });
    await db.collection(COLLECTIONS.payments()).doc(p.id).update({ tenantId: "t2" });
    const truth = await listTruth([p.id]);
    expect(truth).toHaveLength(0);
  });
});

describe("truthOnly non-advancing surface (review round 9)", () => {
  it("a truth-only call returns claimTruth without running the scan or moving its cursors", async () => {
    const ps = [payment(), payment(), payment()];
    for (const p of ps) { await seed(p); await plantClaim(p.id); }
    const run = (data: object) => listRefundWork.run({ data, auth: adminAuth() } as never) as Promise<{
      legacyClaims: { paymentId: string }[]; legacyScanComplete: boolean;
      claimTruth: { paymentId: string; state: string }[];
    }>;
    const t = await run({ knownClaimPaymentIds: [ps[0]!.id], truthOnly: true });
    expect(t.claimTruth.map((x) => x.paymentId)).toEqual([ps[0]!.id]);
    expect(t.claimTruth[0]?.state).toBe("retained");
    expect(t.legacyClaims).toEqual([]);
    expect(t.legacyScanComplete).toBe(true);
    const events = db.collection(COLLECTIONS.paymentEvents());
    expect((await events.doc("reconcileDiscover_t1").get()).exists).toBe(false);
    expect((await events.doc("reconcileFast_t1").get()).exists).toBe(false);
    const scan = await run({ knownClaimPaymentIds: [] });
    expect(new Set(scan.legacyClaims.map((c) => c.paymentId))).toEqual(new Set(ps.map((p) => p.id)));
  });
});

// Track A2 (fresh, local/fake-provider only): refund accounting + outbox runner.
import { describe, it, expect } from "vitest";
import { labelForRefund, verifyRefundAccounting } from "../../lib/refund-accounting.js";
import { reserveRefund, runRefundOutbox, refundablePaise, activeReservation, adoptProcessedRefundEvidence } from "../../lib/refund-outbox.js";
import { fakeFirestore } from "./fake-firestore.js";
import { mockProvider } from "../../lib/mock-payment-provider.js";
import type { Payment } from "@autodeck/core";

const payment = (o: Record<string, unknown> = {}): Payment => ({
  id: "pay1", tenantId: "t1", studioId: "s1", targetType: "job", jobId: "job1", bookingId: "b1",
  membershipId: null, customerId: "c1", amount: 100000, currency: "INR",
  method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
  razorpayPaymentId: "rzp_pay_1", razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
  manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
  completedAt: "2026-10-20T10:00:00.000Z", failedAt: null, cancelledAt: null, refundedAt: null,
  createdAt: "2026-10-20T09:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z", ...o,
});

const seed = (p: Payment) => ({
  payments: { [p.id]: p as unknown as Record<string, unknown> },
  jobs: { job1: { id: "job1", tenantId: "t1", bookingId: "b1", paymentStatus: "paid" } },
  bookings: { b1: { id: "b1", tenantId: "t1", paymentStatus: "paid" } },
});

describe("refund accounting", () => {
  it("labels truthfully across the range", () => {
    expect(labelForRefund(100000, 0)).toBe("completed");
    expect(labelForRefund(100000, 20000)).toBe("partially_refunded");
    expect(labelForRefund(100000, 100000)).toBe("refunded");
  });
  it("retained + refunded always equals captured", () => {
    const c = verifyRefundAccounting({ capturedPaise: 100000, refundedPaise: 20000 });
    expect(c).toMatchObject({ ok: true, label: "partially_refunded", retainedPaise: 80000 });
  });
  it("rejects over-refunds, negatives, non-integers and inconsistent labels", () => {
    expect(verifyRefundAccounting({ capturedPaise: 100, refundedPaise: 101 }).ok).toBe(false);
    expect(verifyRefundAccounting({ capturedPaise: -1, refundedPaise: 0 }).ok).toBe(false);
    expect(verifyRefundAccounting({ capturedPaise: 100.5, refundedPaise: 0 }).ok).toBe(false);
    expect(verifyRefundAccounting({ capturedPaise: 100, refundedPaise: 50, label: "refunded" }).ok).toBe(false);
    expect(verifyRefundAccounting({ capturedPaise: 100, refundedPaise: 100, label: "partially_refunded" }).ok).toBe(false);
    expect(verifyRefundAccounting({ capturedPaise: 100, refundedPaise: 100, label: "refunded" }).ok).toBe(true);
  });
});

describe("refund outbox", () => {
  it("refundable balance is captured minus already refunded", () => {
    expect(refundablePaise(payment())).toBe(100000);
    expect(refundablePaise(payment({ status: "partially_refunded", refundAmount: 20000 }))).toBe(80000);
    expect(refundablePaise(payment({ status: "pending" }))).toBe(0);
  });

  it("reserves once per payment and rejects over-refunds", async () => {
    const { db } = fakeFirestore(seed(payment()));
    const p = payment();
    await reserveRefund(db, { payment: p, amountPaise: 80000, reason: "no-show charge kept", createdBy: "admin1" });
    await expect(reserveRefund(db, { payment: p, amountPaise: 1000, reason: "second", createdBy: "admin1" }))
      .rejects.toThrow(/already has an active refund request/);
    await expect(reserveRefund(db, { payment: p, amountPaise: 100001, reason: "too much", createdBy: "admin1" }))
      .rejects.toThrow(/exceeds the refundable/);
    expect((await activeReservation(db, p.id))?.amountPaise).toBe(80000);
  });

  it("runs reserve -> provider -> truthful projection (partial keeps retained money)", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    await reserveRefund(db, { payment: p, amountPaise: 80000, reason: "no-show: Rs200 retained", createdBy: "admin1" });
    const r = await runRefundOutbox(db, mockProvider);
    expect(r).toEqual({ submitted: 1, projected: 1, failed: 0 });
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "partially_refunded", refundAmount: 80000, razorpayRefundId: "mock_rfnd_rr_pay1_1" });
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("partial");
    expect(data["bookings"]!["b1"]!["paymentStatus"]).toBe("partial");
    expect(data["refundRequests"]!["rr_pay1_1"]).toMatchObject({ status: "projected", projectionNeeded: false });
  });

  it("a full refund labels refunded and marks the invoice hold instead of voiding", async () => {
    const p = payment({ invoiceId: "inv1" });
    const { db, data } = fakeFirestore({ ...seed(p), invoices: { inv1: { id: "inv1", status: "issued" } } });
    await reserveRefund(db, { payment: p, amountPaise: 100000, reason: "waived", createdBy: "admin1" });
    await runRefundOutbox(db, mockProvider);
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "refunded", refundAmount: 100000, invoiceReviewNeeded: true });
    expect(data["invoices"]!["inv1"]!["status"]).toBe("issued"); // hold: never voided by the runner
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("refunded");
  });

  it("recovers a crash after provider submission without resubmitting", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    // Simulate the crash: provider was called, submission recorded, projection never happened.
    let providerCalls = 0;
    const crashing = {
      ...mockProvider,
      initiateRefund: async (params: { referenceId: string }) => { providerCalls++; return { providerRefundId: `mock_rfnd_${params.referenceId}`, status: "processed" }; },
    };
    // First run: submit only (projection hook throws before the projection transaction).
    const { db: db2 } = { db };
    void db2;
    await runRefundOutbox(db, crashing as never);
    expect(providerCalls).toBe(1);
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "projected" });
    // Force the leftover state a crash would leave, then re-run: no new provider call.
    data["refundRequests"]![requestId]!["status"] = "submitted";
    data["refundRequests"]![requestId]!["projectionNeeded"] = true;
    data["payments"]!["pay1"]!["refundAmount"] = null;
    data["payments"]!["pay1"]!["status"] = "completed";
    // The per-refund ledger commits ATOMICALLY with the payment projection in
    // a real Firestore transaction; this forced crash state must clear it
    // too, otherwise it models an impossible half-committed projection.
    delete data["paymentRefunds"];
    const r2 = await runRefundOutbox(db, crashing as never);
    expect(providerCalls).toBe(1); // NOT resubmitted
    expect(r2).toEqual({ submitted: 0, projected: 1, failed: 0 });
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "partially_refunded", refundAmount: 50000 });
  });

  it("a provider failure marks the request failed and refunds nothing", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    await reserveRefund(db, { payment: p, amountPaise: 1000, reason: "x", createdBy: "admin1" });
    const failing = new (await import("../../lib/mock-payment-provider.js")).MockPaymentProvider();
    failing.initiateRefund = async () => { throw new Error("provider down"); };
    failing.authoritativeNegatives = true; // provider confirms the submit never landed
    const r = await runRefundOutbox(db, failing as never);
    expect(r).toEqual({ submitted: 0, projected: 0, failed: 1 });
    expect(data["refundRequests"]!["rr_pay1_1"]).toMatchObject({ status: "failed", lastError: "provider down" });
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
  });
});

describe("ambiguous submit reconciliation", () => {
  it("a lost provider response is reconciled by reference id and projected — never resubmitted", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    const provider = new (await import("../../lib/mock-payment-provider.js")).MockPaymentProvider();
    provider.loseNextRefundResponse = true; // provider accepted, response lost
    let submits = 0;
    const counting = { ...provider, findRefundByReference: provider.findRefundByReference.bind(provider),
      initiateRefund: async (params: { providerPaymentId: string; amount: number; reason: string; referenceId: string }) => { submits++; return provider.initiateRefund(params); } };
    const r = await runRefundOutbox(db, counting as never);
    expect(submits).toBe(1);
    expect(r).toEqual({ submitted: 1, projected: 1, failed: 0 });
    expect(data["refundRequests"]!["rr_pay1_1"]).toMatchObject({ status: "projected", providerRefundId: "mock_rfnd_rr_pay1_1" });
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "partially_refunded", refundAmount: 50000 });
    // A second pass submits nothing more.
    const r2 = await runRefundOutbox(db, counting as never);
    expect(submits).toBe(1);
    expect(r2).toEqual({ submitted: 0, projected: 0, failed: 0 });
  });

  it("an unknown submit outcome holds as ambiguous — no resubmit, no balance release, no second reservation", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    let submits = 0;
    const noLookup = { name: "mock", initiateRefund: async () => { submits++; throw new Error("maybe accepted"); } };
    const r = await runRefundOutbox(db, noLookup as never);
    expect(submits).toBe(1);
    expect(data["refundRequests"]!["rr_pay1_1"]).toMatchObject({ status: "ambiguous" });
    // The runner never retries or resolves it without provider evidence.
    const r2 = await runRefundOutbox(db, noLookup as never);
    expect(submits).toBe(1);
    expect(r2).toEqual({ submitted: 0, projected: 0, failed: 0 });
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
    // Cross-request: the ambiguous hold blocks a SECOND reservation for the
    // same payment, so the possibly-submitted amount can never double-refund.
    await expect(reserveRefund(db, { payment: p, amountPaise: 1000, reason: "second", createdBy: "admin1" }))
      .rejects.toThrow(/already has an active refund request/);
    expect(Object.keys(data["refundRequests"] ?? {}).filter((k) => k.startsWith("rr_"))).toHaveLength(1);
  });

  it("an ambiguous hold reconciles only from provider evidence: found -> projected, absent -> failed", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    const provider = new (await import("../../lib/mock-payment-provider.js")).MockPaymentProvider();
    provider.loseNextRefundResponse = true; // accepted, response lost -> ambiguous
    await runRefundOutbox(db, provider);
    expect(data["refundRequests"]!["rr_pay1_1"]!["status"]).toBe("projected"); // reconciled via lookup, then projected in the same pass
    // Force the leftover ambiguous state (accepted at provider, nothing
    // recorded locally), then reconcile from provider evidence.
    data["refundRequests"]!["rr_pay1_1"]!["status"] = "ambiguous";
    data["refundRequests"]!["rr_pay1_1"]!["projectionNeeded"] = false;
    data["payments"]!["pay1"]!["refundAmount"] = null;
    data["payments"]!["pay1"]!["status"] = "completed";
    // Clear the atomically-committed ledger too: the forced state models a
    // crash before the projection transaction committed at all.
    delete data["paymentRefunds"];
    const r = await runRefundOutbox(db, provider);
    expect(r).toEqual({ submitted: 1, projected: 1, failed: 0 });
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "partially_refunded", refundAmount: 50000 });
    // Confirmed-absent case: provider authoritatively confirms nothing was
    // accepted -> failed, balance released.
    const p2 = payment({ id: "pay2", bookingId: "b2" });
    const f2 = fakeFirestore({ payments: { pay2: p2 as never },
      jobs: { job1: { id: "job1", tenantId: "t1", bookingId: "b2", paymentStatus: "paid" } },
      bookings: { b2: { id: "b2", tenantId: "t1", paymentStatus: "paid" } } });
    await reserveRefund(f2.db, { payment: p2, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    f2.data["refundRequests"]!["rr_pay2_1"]!["status"] = "ambiguous";
    const provider2 = new (await import("../../lib/mock-payment-provider.js")).MockPaymentProvider();
    provider2.authoritativeNegatives = true;
    const r2b = await runRefundOutbox(f2.db, provider2);
    expect(r2b.failed).toBe(1);
    expect(f2.data["refundRequests"]!["rr_pay2_1"]!["status"]).toBe("failed");
    expect(f2.data["payments"]!["pay2"]!["status"]).toBe("completed");
  });

  it("an inconclusive lookup (unknown) keeps the hold and keeps blocking new reservations", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    data["refundRequests"]!["rr_pay1_1"]!["status"] = "ambiguous";
    // Default mock: a miss reports "unknown" (no authoritative negative).
    const provider = new (await import("../../lib/mock-payment-provider.js")).MockPaymentProvider();
    for (let i = 0; i < 3; i++) {
      const r = await runRefundOutbox(db, provider);
      expect(r).toEqual({ submitted: 0, projected: 0, failed: 0 });
      expect(data["refundRequests"]!["rr_pay1_1"]!["status"]).toBe("ambiguous");
      await expect(reserveRefund(db, { payment: p, amountPaise: 1000, reason: "again", createdBy: "admin1" }))
        .rejects.toThrow(/already has an active refund request/);
    }
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
    expect(data["payments"]!["pay1"]!["refundAmount"]).toBeNull();
  });
});

describe("adoptProcessedRefundEvidence + reconcile-only passes", () => {
  it("adopts a webhook's processed evidence into its OWN reserved request and projects with ZERO provider submissions", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    let providerCalls = 0;
    const spy = { ...mockProvider, initiateRefund: async () => { providerCalls++; throw new Error("must not submit"); } };
    const adopted = await adoptProcessedRefundEvidence(db, { requestId, providerRefundId: "rfnd_evt", amountPaise: 50000, currency: "INR" });
    expect(adopted).toBe("adopted");
    const r = await runRefundOutbox(db, spy as never, { requestId, submit: false });
    expect(providerCalls).toBe(0); // evidence, not a new provider refund
    expect(r).toEqual({ submitted: 0, projected: 1, failed: 0 });
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "partially_refunded", refundAmount: 50000, razorpayRefundId: "rfnd_evt" });
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "projected", providerRefundId: "rfnd_evt" });
    expect(data["paymentRefunds"]![`pr_pay1_rfnd_evt`]).toMatchObject({ source: "outbox", requestId, amountPaise: 50000 });
  });

  it("adoption fails CLOSED on conflicting amount/currency and on an already-accounted provider refund (zero writes)", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    expect(await adoptProcessedRefundEvidence(db, { requestId, providerRefundId: "rfnd_1", amountPaise: 99999, currency: "INR" })).toBe("conflict");
    expect(await adoptProcessedRefundEvidence(db, { requestId, providerRefundId: "rfnd_1", amountPaise: 50000, currency: "USD" })).toBe("conflict");
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "reserved", providerRefundId: null });
    // The same provider refund already accounted by another path: never re-bind.
    data["paymentRefunds"] = { pr_pay1_rfnd_leg: { paymentId: "pay1", providerRefundId: "rfnd_leg", source: "legacy", amountPaise: 50000, currency: "INR" } };
    expect(await adoptProcessedRefundEvidence(db, { requestId, providerRefundId: "rfnd_leg", amountPaise: 50000, currency: "INR" })).toBe("conflict");
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "reserved", providerRefundId: null });
  });

  it("a reconcile-only (submit:false) pass NEVER submits reserved requests", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    let providerCalls = 0;
    const spy = { ...mockProvider, initiateRefund: async () => { providerCalls++; throw new Error("must not submit"); } };
    const r = await runRefundOutbox(db, spy as never, { submit: false });
    expect(r).toEqual({ submitted: 0, projected: 0, failed: 0 });
    expect(providerCalls).toBe(0);
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "reserved" });
  });

  it("a projection rejection becomes a durable HOLD, not a crashed pass", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "admin1" });
    await adoptProcessedRefundEvidence(db, { requestId, providerRefundId: "rfnd_evt", amountPaise: 50000, currency: "INR" });
    // A foreign ledger entry for the SAME provider refund id appears before
    // the projection runs: projection must hold, and the pass must report it.
    data["paymentRefunds"] = { pr_pay1_rfnd_evt: { paymentId: "pay1", providerRefundId: "rfnd_evt", source: "webhook", amountPaise: 50000, currency: "INR" } };
    const r = await runRefundOutbox(db, mockProvider, { requestId, submit: false });
    expect(r).toEqual({ submitted: 0, projected: 0, failed: 1 });
    expect(data["payments"]!["pay1"]!["refundAmount"] ?? null).toBeNull(); // no double count
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "ambiguous" });
    expect(String(data["refundRequests"]![requestId]!["lastError"])).toMatch(/projection held/);
  });
});

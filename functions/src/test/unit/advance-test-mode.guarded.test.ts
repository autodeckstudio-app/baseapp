/* eslint-disable @typescript-eslint/no-explicit-any */
// Advance pay-at-studio: exact split reconciliation + guarded live-TEST round trip.
//
// Part 1 (always runs, no network): pins the owner-adopted 2 Nov split and the
// EXACT service/pickup/total/balance reconciliation on the release fixture.
//
// Part 2 (guarded, network): real requestAdvancePayment handler + real
// RazorpayProvider against api.razorpay.com TEST mode, in-memory Firestore
// (module mock, paper-review pattern), flag seam flipped in-process only.
// RUNS ONLY when RAZORPAY_KEY_ID has an rzp_test_ prefix AND
// RAZORPAY_KEY_SECRET is set; skips otherwise (never against live keys).
// Partial integration evidence: real provider + real handler with a fake
// datastore and an injected callable context - NOT real Firebase
// Authentication, NOT the deployed endpoint, NOT actual webhook delivery.
import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ store: new Map<string, any>() }));

vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "subj" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("../../lib/advance-payment.js", async (importOriginal) => {
  const mod = await importOriginal<any>();
  // In-process flag seam ONLY (production flag untouched, stays FALSE):
  // exercises the exact handler code the deployed function runs post-activation.
  return { ...mod, advancePaymentEnabled: () => true };
});
vi.mock("firebase-admin/firestore", () => {
  const key = (coll: string, id: string) => `${coll}/${id}`;
  const snap = (coll: string, id: string) => ({ exists: h.store.has(key(coll, id)), data: () => h.store.get(key(coll, id)) });
  const applyUpdate = (cur: any, patch: any) => {
    const out = { ...(cur ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v && (v as any).__arrayUnion !== undefined) out[k] = [...(cur?.[k] ?? []), (v as any).__arrayUnion];
      else out[k] = v;
    }
    return out;
  };
  const makeRef = (coll: string, id: string): any => ({
    id,
    __coll: coll,
    get: async () => snap(coll, id),
    set: async (data: any) => { h.store.set(key(coll, id), { ...data }); },
    update: async (patch: any) => { h.store.set(key(coll, id), applyUpdate(h.store.get(key(coll, id)), patch)); },
  });
  const tx = {
    get: async (ref: any) => snap(ref.__coll, ref.id),
    set: (ref: any, data: any) => { h.store.set(key(ref.__coll, ref.id), { ...data }); },
    update: (ref: any, patch: any) => { h.store.set(key(ref.__coll, ref.id), applyUpdate(h.store.get(key(ref.__coll, ref.id)), patch)); },
  };
  const db: any = {
    collection: (coll: string) => ({ doc: (id: string) => makeRef(coll, id) }),
    runTransaction: async (fn: any) => fn(tx),
  };
  return { getFirestore: () => db, FieldValue: { arrayUnion: (v: any) => ({ __arrayUnion: v }) } };
});

import { computeAdvanceSplitFromBreakdown, buildAdvancePaymentRequest } from "../../lib/advance-payment.js";
import { requestAdvancePayment } from "../../functions/payment/requestAdvancePayment.js";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";

// Release fixture: service subtotal 100000 + pickup 5000 + drop 3000 folded
// into subtotal (applyPickupFees); GST 18%; booking total 127440.
const BREAKDOWN = { subtotal: 108000, pickupFee: 5000, dropFee: 3000, membershipDiscount: null, taxRatePercent: 18, total: 127440 };
const BOOKING = {
  id: "advance-probe-1", tenantId: "t1", studioId: "s1", customerId: "cust-1",
  status: "PENDING", paymentStatus: "unpaid", payMode: "studio",
  holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  priceBreakdown: BREAKDOWN,
};

describe("advance split exact reconciliation (2 Nov owner policy)", () => {
  it("pins service base, advance, service balance, pickup/drop and booking total", () => {
    const split = computeAdvanceSplitFromBreakdown(BREAKDOWN, "service_total_only", "ceil");
    // Base: service only (subtotal minus pickup AND drop), discounted, incl GST: 100000 * 1.18 = 118000.
    const SERVICE_BASE = 118000;
    expect(split.advancePaise).toBe(23600); // ceil(20% of 118000) = exactly Rs 236.00
    expect(split.dueAtStudioPaise).toBe(94400); // SERVICE balance at studio: 118000 - 23600
    expect(split.advancePaise + split.dueAtStudioPaise).toBe(SERVICE_BASE);

    const req = buildAdvancePaymentRequest(
      { id: BOOKING.id, payMode: "studio", currency: "INR", priceBreakdown: BREAKDOWN, advancePaymentId: null },
      "service_total_only", "ceil", { enabled: true },
    );
    expect(req.amountPaise).toBe(23600);
    // Studio-collected balance = booking TOTAL (incl pickup+drop and their GST) minus the advance:
    // 127440 - 23600 = 103840 = 94400 service balance + 9440 pickup/drop incl GST (8000 * 1.18).
    expect(req.dueAtStudioPaise).toBe(103840);
    expect(req.dueAtStudioPaise - split.dueAtStudioPaise).toBe(9440); // pickup+drop incl GST stays at the studio
    expect(req.amountPaise + req.dueAtStudioPaise).toBe(BREAKDOWN.total); // nothing lost, nothing double-counted
  });
});

const RUN = !!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") && !!process.env.RAZORPAY_KEY_SECRET;

describe("advance handler + real Razorpay TEST provider (guarded)", () => {
  it.skipIf(!RUN)("claim -> real TEST link -> bind; idempotent retry; cancel cleanup", async () => {
    h.store.set(`bookings/${BOOKING.id}`, BOOKING);
    h.store.set("customers/cust-1", { name: "Probe Customer", phone: "" });
    const req = (): any => ({
      data: { bookingId: BOOKING.id },
      auth: { uid: "cust-1", token: { role: "customer", tenantId: "t1", studioId: null } },
    });

    const first = await requestAdvancePayment.run(req());
    expect(first.paymentId).toBe(`advance-${BOOKING.id}`);
    expect(first.status).toBe("pending");
    expect(typeof first.paymentUrl).toBe("string");

    const payment = h.store.get(`payments/advance-${BOOKING.id}`);
    expect(payment.status).toBe("pending");
    expect(payment.amount).toBe(23600); // the exact owner-adopted advance, never client-supplied
    expect(payment.orderAmbiguous).toBe(false);
    expect(payment.linkCreateLeaseId).toBeNull();
    expect(payment.razorpayPaymentLinkId).toMatch(/^plink_/);
    expect(payment.paymentUrl).toBe(first.paymentUrl);
    expect(h.store.get(`bookings/${BOOKING.id}`).advancePaymentId).toBe(`advance-${BOOKING.id}`);

    // Idempotent retry: reconcile-first returns the SAME link, never a second one.
    const retry = await requestAdvancePayment.run(req());
    expect(retry.paymentUrl).toBe(first.paymentUrl);
    expect(h.store.get(`payments/advance-${BOOKING.id}`).razorpayPaymentLinkId).toBe(payment.razorpayPaymentLinkId);

    // Cleanup: cancel the TEST link (test namespace; no charge possible).
    const provider = new RazorpayProvider(process.env.RAZORPAY_KEY_ID!, process.env.RAZORPAY_KEY_SECRET!, "unused");
    const cancelled = await provider.cancelPaymentLink(payment.razorpayPaymentLinkId);
    expect(["cancelled", "already_inactive"]).toContain(cancelled.outcome);
  }, 60000);
});

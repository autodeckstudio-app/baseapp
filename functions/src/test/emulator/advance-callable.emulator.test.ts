/**
 * TEST. W1: the requestAdvancePayment CALLABLE composed with ensureAdvanceLink
 * against the MOCK provider on the real emulator: claim, create, idempotent
 * retry (reconcile-first), guard order, manual review on provider-paid link.
 * The advance flag is vi.mocked ON here only; the shipped const stays false.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";

process.env["USE_PAYMENT_MOCK"] = "true";

const h = vi.hoisted(() => ({ enabled: true }));
// The flag is a module-level const that buildAdvancePaymentRequest closes
// over, so a spread-override cannot flip the INTERNAL check. Override both
// explicitly: the exported flag AND a buildAdvancePaymentRequest that runs
// the REAL computation minus the disabled check. Everything else (split
// math, studio balance, payMode/existing-advance guards) is the real code.
vi.mock("../../lib/advance-payment.js", async (orig) => {
  const m = await orig<typeof import("../../lib/advance-payment.js")>();
  return {
    ...m,
    get ADVANCE_PAYMENT_ENABLED() { return h.enabled; },
    buildAdvancePaymentRequest: (booking: Parameters<typeof m.buildAdvancePaymentRequest>[0], basis: Parameters<typeof m.buildAdvancePaymentRequest>[1], rounding: Parameters<typeof m.buildAdvancePaymentRequest>[2]) => {
      if (!h.enabled) throw new Error("Advance split payments are disabled (ADVANCE_PAYMENT_ENABLED=false): policy is owner-adopted; the activation gate (final review) is outstanding.");
      if (booking.payMode !== "studio") throw new Error(`Advance applies to pay-at-studio bookings only (payMode=${booking.payMode}).`);
      if (booking.advancePaymentId) throw new Error("An advance payment is already recorded for this booking.");
      const split = m.computeAdvanceSplitFromBreakdown(booking.priceBreakdown, basis, rounding);
      return {
        amountPaise: split.advancePaise,
        currency: booking.currency,
        bookingId: booking.id,
        description: "Advance for your AutoDeck booking (balance payable at the studio)",
        referenceId: `advance-${booking.id}`,
        advancePaise: split.advancePaise,
        dueAtStudioPaise: m.studioBalancePaise(booking.priceBreakdown, split.advancePaise),
      };
    },
  };
});

import { requestAdvancePayment } from "../../functions/payment/requestAdvancePayment.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { MockPaymentProvider } from "../../lib/mock-payment-provider.js";

const db = getFirestore();
beforeAll(() => {
  if (!process.env["FIRESTORE_EMULATOR_HOST"]) {
    throw new Error("advance-callable tests write to Firestore; refusing without FIRESTORE_EMULATOR_HOST (never a real backend).");
  }
});

let n = 0;
const auth = (uid: string) => ({ uid, token: { role: "customer", tenantId: "ac-t", studioId: "ac-s" }, rawToken: "t" });

async function seed(o: { status?: string; payMode?: string } = {}) {
  n += 1; const id = `${Date.now()}${n}`;
  const customerId = `ac-c-${id}`, bookingId = `ac-b-${id}`;
  await db.collection("customers").doc(customerId).set({ id: customerId, tenantId: "ac-t", name: "Test Customer", phone: "+919000000001" });
  await db.collection("bookings").doc(bookingId).set({
    id: bookingId, tenantId: "ac-t", studioId: "ac-s", customerId,
    status: o.status ?? "CONFIRMED", payMode: o.payMode ?? "studio",
    priceBreakdown: {
      currency: "INR", subtotal: 108000, pickupFee: 5000, dropFee: 3000,
      membershipDiscount: null, taxRatePercent: 18, tax: 19440, total: 127440,
    },
  });
  return { customerId, bookingId, paymentId: `advance-${bookingId}` };
}

describe("requestAdvancePayment callable (W1, flag mocked on, mock provider)", () => {
  it("guard is FIRST: with the flag OFF the callable is inert (no reads, no writes, no provider)", async () => {
    h.enabled = false;
    const s = await seed();
    await expect(requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never))
      .rejects.toThrow(/not enabled/);
    expect((await db.collection("payments").doc(s.paymentId).get()).exists).toBe(false);
    h.enabled = true;
  });

  it("happy path: claim + provider create + committed record with the adopted 20% split", async () => {
    const s = await seed();
    const r = (await requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never)) as
      { paymentId: string; paymentUrl: string; status: string };
    expect(r.paymentId).toBe(s.paymentId);
    expect(r.status).toBe("pending");
    expect(r.paymentUrl).toContain("mock-razorpay.local");
    const pay = (await db.collection("payments").doc(s.paymentId).get()).data()!;
    expect(pay.amount).toBe(23600); // ceil 20% of 118000
    expect(pay.targetType).toBe("booking");
    expect(pay.razorpayPaymentLinkId).toBeTruthy();
    expect(pay.orderAmbiguous ?? null).toBeNull();
    const bk = (await db.collection("bookings").doc(s.bookingId).get()).data()!;
    expect(bk.advancePaymentId).toBe(s.paymentId);
  });

  it("retry reconciles FIRST: same link id and URL, no duplicate payable link", async () => {
    const s = await seed();
    const r1 = (await requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never)) as { paymentUrl: string };
    const r2 = (await requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never)) as { paymentUrl: string };
    expect(r2.paymentUrl).toBe(r1.paymentUrl);
    const pay = (await db.collection("payments").doc(s.paymentId).get()).data()!;
    const provider = getPaymentProvider() as MockPaymentProvider;
    // The provider holds exactly ONE link for this reference: no duplicate.
    const fetched = await provider.fetchPaymentLink(pay.razorpayPaymentLinkId);
    expect(fetched).toBeTruthy();
    expect(fetched!.amount).toBe(23600);
  });

  it("provider-paid link while our record is pending -> manual_review status + REAL staff alert, no URL handed out", async () => {
    const s = await seed();
    await requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never);
    const provider = getPaymentProvider() as MockPaymentProvider;
    const pay = (await db.collection("payments").doc(s.paymentId).get()).data()!;
    const orig = provider.fetchPaymentLink.bind(provider);
    provider.fetchPaymentLink = async (id: string) => {
      const r = await orig(id);
      return r ? { ...r, status: "paid" } : r;
    };
    try {
      const r = (await requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never)) as
        { paymentUrl: string | null; status: string };
      expect(r.status).toBe("manual_review");
      expect(r.paymentUrl).toBeNull(); // never hand out a money-attached link
      const alert = await db.collection("staffAlerts").doc(`advance_review_${s.paymentId}`).get();
      expect(alert.exists).toBe(true);
      expect(alert.data()!["kind"]).toBe("advance_manual_review");
    } finally {
      provider.fetchPaymentLink = orig;
    }
  });

  it("another customer's booking is rejected; a CANCELLED booking is rejected", async () => {
    const s = await seed();
    await expect(requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth("someone-else") } as never))
      .rejects.toThrow(/another customer/);
    const s2 = await seed({ status: "CANCELLED" });
    await expect(requestAdvancePayment.run({ data: { bookingId: s2.bookingId }, auth: auth(s2.customerId) } as never))
      .rejects.toThrow(/CANCELLED/);
  });

  it("payMode online bookings are rejected (advance applies to pay-at-studio only)", async () => {
    const s = await seed({ payMode: "online" });
    await expect(requestAdvancePayment.run({ data: { bookingId: s.bookingId }, auth: auth(s.customerId) } as never))
      .rejects.toThrow(/pay-at-studio/);
  });
});

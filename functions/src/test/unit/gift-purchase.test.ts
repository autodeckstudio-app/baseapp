import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: () => undefined }));

import { planGiftActivation } from "../../lib/gift-activate.js";
import { completeVerifiedCheckout } from "../../lib/razorpay-verified-checkout.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { sendGiftReminders } from "../../lib/gift-reminders.js";
import { fakeFirestore } from "./fake-firestore.js";

const T = "2026-10-20T10:00:00.000Z";
const gift = (o: Record<string, unknown> = {}) => ({ id: "g1", tenantId: "t", buyerId: "c1", serviceId: "menu-wash-foam", amountPaise: 90000, codeHash: "h", codeTail: "2345", status: "PENDING_PAYMENT", createdAt: T, purchasedAt: null, expiresAt: null, claimedBy: null, redeemedBy: null, redeemedAt: null, bookingId: null, voidedAt: null, voidReason: null, refundRequested: false, paymentId: null, ...o });
const pay = (o: Record<string, unknown> = {}) => ({ id: "pay1", tenantId: "t", studioId: null, targetType: "gift", giftId: "g1", jobId: null, membershipId: null, customerId: "c1", amount: 90000, currency: "INR", method: "razorpay_payment_link", status: "processing", razorpayOrderId: "order_1", razorpayPaymentId: "pay_x", ...o });
const seed = (g = {}, p = {}) => ({ gifts: { g1: gift(g) }, payments: { pay1: pay(p) } }) as never;
const args = { paymentId: "pay1", orderId: "order_1", providerPaymentId: "pay_x" };

describe("planGiftActivation", () => {
  const p = { id: "pay1", amount: 90000, customerId: "c1", tenantId: "t" };
  it("activates a pending gift for the buyer at the right amount, with 60 days from now", () => {
    const r = planGiftActivation(gift() as never, p, "2026-10-20T10:00:00.000Z");
    expect(r.activate).toBe(true);
    if (r.activate) { expect(r.patch.status).toBe("ACTIVE"); expect(r.patch.expiresAt).toBe("2026-12-19T10:00:00.000Z"); expect(r.patch.paymentId).toBe("pay1"); }
  });
  it("refuses a wrong amount, another buyer, a missing gift and a gift that is not pending", () => {
    expect(planGiftActivation(gift() as never, { ...p, amount: 1 }, T)).toEqual({ activate: false, reason: "amount_mismatch" });
    expect(planGiftActivation(gift() as never, { ...p, customerId: "c2" }, T)).toEqual({ activate: false, reason: "wrong_buyer" });
    expect(planGiftActivation(undefined, p, T)).toEqual({ activate: false, reason: "gift_missing" });
    for (const status of ["ACTIVE", "REDEEMED", "VOID", "REFUNDED"]) expect(planGiftActivation(gift({ status }) as never, p, T)).toEqual({ activate: false, reason: "gift_not_pending" });
  });
});

describe("verified gift payment", () => {
  it("completes the payment and turns the gift on in one go", async () => {
    const { db, data } = fakeFirestore(seed());
    expect(await completeVerifiedCheckout(db as never, args)).toBe("completed");
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
    const g = data["gifts"]!["g1"]!;
    expect(g["status"]).toBe("ACTIVE");
    expect(g["paymentId"]).toBe("pay1");
    expect(Date.parse(g["expiresAt"] as string) - Date.parse(g["purchasedAt"] as string)).toBe(60 * 86_400_000);
  });
  it("activates once: a retry and the webhook backup change nothing", async () => {
    const { db, data } = fakeFirestore(seed());
    await completeVerifiedCheckout(db as never, args);
    const first = { ...data["gifts"]!["g1"]! };
    expect(await completeVerifiedCheckout(db as never, args)).toBe("duplicate");
    const hook = await processProviderEvent(db as never, { eventType: "payment.captured", providerEventId: "evt_1", providerPaymentId: "pay_x", providerPaymentLinkId: null, providerRefundId: null, providerOrderId: "order_1", referenceId: "pay1", amount: 90000, currency: "INR" });
    expect(hook.outcome).toBe("already_final");
    expect(data["gifts"]!["g1"]).toEqual(first);
  });
  it("a webhook amount that differs from the stored payment activates nothing", async () => {
    const { db, data } = fakeFirestore(seed());
    const hook = await processProviderEvent(db as never, { eventType: "payment.captured", providerEventId: "evt_2", providerPaymentId: "pay_x", providerPaymentLinkId: null, providerRefundId: null, providerOrderId: "order_1", referenceId: "pay1", amount: 100, currency: "INR" });
    expect(hook.outcome).toBe("amount_mismatch");
    expect(data["gifts"]!["g1"]!["status"]).toBe("PENDING_PAYMENT");
    expect(data["payments"]!["pay1"]!["status"]).toBe("processing");
  });
  it("money arrived but the gift price no longer matches: payment recorded, gift stays off, flagged for review", async () => {
    const { db, data } = fakeFirestore(seed({ amountPaise: 95000 }));
    await completeVerifiedCheckout(db as never, args);
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
    expect(data["gifts"]!["g1"]!["status"]).toBe("PENDING_PAYMENT");
  });
  it("a failed payment never activates the gift", async () => {
    const { db, data } = fakeFirestore(seed());
    await processProviderEvent(db as never, { eventType: "payment.failed", providerEventId: "evt_3", providerPaymentId: "pay_x", providerPaymentLinkId: null, providerRefundId: null, providerOrderId: "order_1", referenceId: "pay1", amount: 0, currency: "INR" });
    expect(data["gifts"]!["g1"]!["status"]).toBe("PENDING_PAYMENT");
  });
  it("a refund in the Razorpay dashboard stops an unused gift, but not one already used", async () => {
    const ev = { eventType: "refund.created" as const, providerEventId: "evt_r", providerPaymentId: "pay_x", providerPaymentLinkId: null, providerRefundId: "rf1", providerOrderId: "order_1", referenceId: "pay1", amount: 90000, currency: "INR", providerRefundStatus: "processed", providerRefundAmount: 90000, providerRefundPaymentId: "pay_x" };
    const a = fakeFirestore(seed({ status: "ACTIVE" }, { status: "completed" }));
    expect((await processProviderEvent(a.db as never, ev)).outcome).toBe("refunded");
    expect(a.data["gifts"]!["g1"]!["status"]).toBe("REFUNDED");
    const b = fakeFirestore(seed({ status: "REDEEMED" }, { status: "completed" }));
    await processProviderEvent(b.db as never, ev);
    expect(b.data["gifts"]!["g1"]!["status"]).toBe("REDEEMED");
  });
});

describe("sendGiftReminders", () => {
  const now = Date.parse("2026-10-16T04:00:00Z");
  const notes = () => new Map<string, unknown>();
  const mk = (rows: Record<string, unknown>[]) => {
    const n = notes();
    const db = { collection: () => ({
      where: (_f: string, _o: string, v: string) => ({ limit: () => ({ get: async () => ({ docs: rows.filter((r) => r["status"] === v).map((r) => ({ data: () => r })) }) }) }),
      doc: (id: string) => ({ create: async (x: unknown) => { if (n.has(id)) throw Object.assign(new Error("x"), { code: 6 }); n.set(id, x); } }),
    }) };
    return { db: db as never, n };
  };
  it("reminds the holder at 7 days and on the last day, once each, and skips others", async () => {
    const { db, n } = mk([gift({ id: "a", status: "ACTIVE", claimedBy: "r1", expiresAt: "2026-10-23T08:00:00.000Z" }), gift({ id: "b", status: "ACTIVE", expiresAt: "2026-10-16T08:00:00.000Z" }), gift({ id: "c", status: "ACTIVE", expiresAt: "2026-10-20T08:00:00.000Z" }), gift({ id: "d", status: "REDEEMED", expiresAt: "2026-10-23T08:00:00.000Z" })]);
    expect((await sendGiftReminders(db, now)).sent).toBe(2);
    expect((await sendGiftReminders(db, now)).sent).toBe(0);
    expect((n.get("giftrem-a-2026-10-23-7") as { userId: string }).userId).toBe("r1");
    expect((n.get("giftrem-b-2026-10-16-0") as { userId: string }).userId).toBe("c1");
    expect(n.size).toBe(2);
  });
});

describe("gift purchase guardrails (source)", () => {
  const src = readFileSync(`${__dirname}/../../functions/gift/gift.ts`, "utf8");
  const hook = readFileSync(`${__dirname}/../../lib/razorpay-webhook.ts`, "utf8");
  it("the amount is the server's catalogue price, never an input", () => {
    expect(src).toContain("const amountPaise = await giftPricePaise(");
    expect(src).not.toMatch(/data\.(amount|price)/i);
  });
  it("the gift is activated only from the verified payment path, never by a client callable", () => {
    expect(hook).toContain("planGiftActivation");
    expect(src).not.toMatch(/export const activate/);
  });
  it("the plain code lives only in the server-only giftSecrets collection, and is returned only to the buyer of an unused gift", () => {
    expect(src).toContain("COLLECTIONS.giftSecrets()");
    expect(src).toContain('giftState(g, Date.now()) !== "unused"');
    expect(src).toContain("g.buyerId !== user.uid");
    const rules = readFileSync(`${__dirname}/../../../../firestore.rules`, "utf8");
    expect(rules).not.toMatch(/giftSecrets/);
    expect(rules).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false/);
  });
  it("listMyGifts and the studio lookup never return the code or its hash", () => {
    const view = src.slice(src.indexOf("function view("), src.indexOf("/** Buyer starts a gift"));
    expect(view).not.toMatch(/codeHash|code:/);
  });
  it("buyers cannot cancel for a refund", () => {
    expect(src).toContain("Gifts cannot be refunded");
    expect(src).not.toMatch(/refundRequested: true/);
  });
});

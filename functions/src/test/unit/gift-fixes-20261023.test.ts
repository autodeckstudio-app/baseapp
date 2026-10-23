// Tests for the 2026-10-23 Gifts fixes (new candidate, built fresh on d1050cd):
// duplicate-purchase protection via the buyer slot, refunded-credit invalidation on
// refund and on cancel-restore, and checkout order reuse/ambiguous-reconciliation.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: () => undefined }));

import { createGiftPurchase, slotReusable, type GiftPurchaseSlot } from "../../lib/gift-purchase.js";
import { obtainCheckoutOrder, CheckoutOrderError } from "../../lib/checkout-order.js";
import { readCancelReads, writeCancelRestores } from "../../lib/cancel-booking.js";
import { fakeFirestore } from "./fake-firestore.js";

const T = "2026-10-20T10:00:00.000Z";
const user = (uid = "c1") => ({ uid, displayName: null, phone: null, email: null, claims: { role: "customer", tenantId: "t", studioId: null } }) as never;

describe("createGiftPurchase", () => {
  it("creates gift, payment, secret and slot together", async () => {
    const { db, data } = fakeFirestore({});
    const r = await createGiftPurchase(db as never, user(), 90000);
    expect(r.reused).toBe(false);
    const g = data["gifts"]![r.giftId]!;
    const p = data["payments"]![r.paymentId]!;
    expect(g["status"]).toBe("PENDING_PAYMENT");
    expect(g["buyerId"]).toBe("c1");
    expect(p["giftId"]).toBe(r.giftId);
    expect(p["status"]).toBe("pending");
    expect(data["giftSecrets"]![r.giftId]!["code"]).toMatch(/^GW/);
    const slot = data["giftPurchaseSlots"]!["c1"]! as unknown as GiftPurchaseSlot;
    expect(slot.giftId).toBe(r.giftId);
    expect(slot.paymentId).toBe(r.paymentId);
  });

  it("a second start (double-tap / retry / reload) returns the same purchase, no duplicates", async () => {
    const { db, data } = fakeFirestore({});
    const first = await createGiftPurchase(db as never, user(), 90000);
    const second = await createGiftPurchase(db as never, user(), 90000);
    expect(second).toMatchObject({ giftId: first.giftId, paymentId: first.paymentId, reused: true });
    expect(Object.keys(data["gifts"]!)).toHaveLength(1);
    expect(Object.keys(data["payments"]!)).toHaveLength(1);
  });

  it("a paid (processing) purchase is still reused; a closed one is not", async () => {
    const { db, data } = fakeFirestore({});
    const first = await createGiftPurchase(db as never, user(), 90000);
    data["payments"]![first.paymentId]!["status"] = "processing";
    const again = await createGiftPurchase(db as never, user(), 90000);
    expect(again.giftId).toBe(first.giftId);
    data["payments"]![first.paymentId]!["status"] = "failed";
    const fresh = await createGiftPurchase(db as never, user(), 90000);
    expect(fresh.reused).toBe(false);
    expect(fresh.giftId).not.toBe(first.giftId);
  });

  it("adopts a slotless recent unpaid gift instead of duplicating it", async () => {
    const old = { id: "g-old", tenantId: "t", buyerId: "c1", serviceId: "menu-wash-foam", amountPaise: 90000, codeHash: "h", codeTail: "1", status: "PENDING_PAYMENT", createdAt: new Date().toISOString(), purchasedAt: null, expiresAt: null, claimedBy: null, redeemedBy: null, redeemedAt: null, bookingId: null, voidedAt: null, voidReason: null, refundRequested: false, paymentId: null };
    const oldPay = { id: "p-old", status: "pending", giftId: "g-old" };
    const { db, data } = fakeFirestore({ gifts: { "g-old": old }, payments: { "p-old": oldPay } } as never);
    const r = await createGiftPurchase(db as never, user(), 90000);
    expect(r).toMatchObject({ giftId: "g-old", paymentId: "p-old", reused: true });
    expect(Object.keys(data["gifts"]!)).toHaveLength(1);
    expect(data["giftPurchaseSlots"]!["c1"]).toBeTruthy();
  });

  it("another buyer gets their own purchase", async () => {
    const { db, data } = fakeFirestore({});
    const a = await createGiftPurchase(db as never, user("c1"), 90000);
    const b = await createGiftPurchase(db as never, user("c2"), 90000);
    expect(b.giftId).not.toBe(a.giftId);
    expect(Object.keys(data["gifts"]!)).toHaveLength(2);
  });
});

describe("slotReusable", () => {
  const slot: GiftPurchaseSlot = { giftId: "g", paymentId: "p", amountPaise: 90000, updatedAt: T };
  const g = { status: "PENDING_PAYMENT" } as never;
  const p = { status: "pending" } as never;
  it("rejects wrong amount, stale slot, missing docs and moved-on states", () => {
    const now = Date.parse(T) + 60_000;
    expect(slotReusable(slot, g, p, 90000, now)).toBe(true);
    expect(slotReusable(slot, g, p, 80000, now)).toBe(false);
    expect(slotReusable(slot, g, p, 90000, now + 25 * 3_600_000)).toBe(false);
    expect(slotReusable(slot, undefined, p, 90000, now)).toBe(false);
    expect(slotReusable(slot, { status: "ACTIVE" } as never, p, 90000, now)).toBe(false);
    expect(slotReusable(slot, g, { status: "completed" } as never, 90000, now)).toBe(false);
  });
});

describe("obtainCheckoutOrder", () => {
  const payment = (o: Record<string, unknown> = {}) => ({ id: "pay1", amount: 90000, currency: "INR", razorpayOrderId: null, orderAmbiguous: null, ...o }) as never;
  const deps = () => {
    const calls = { create: 0, find: 0, saved: [] as string[], ambiguous: [] as boolean[] };
    return {
      calls,
      createOrder: async () => { calls.create++; return { id: `order_${calls.create}`, amount: 90000, currency: "INR" }; },
      findOrderByReceipt: async () => { calls.find++; return null; },
      saveOrder: async (id: string) => { calls.saved.push(id); },
      markAmbiguous: async (b: boolean) => { calls.ambiguous.push(b); },
    };
  };

  it("reuses the stored order id and never creates a second one", async () => {
    const d = deps();
    const r = await obtainCheckoutOrder(payment({ razorpayOrderId: "order_9" }), d);
    expect(r).toMatchObject({ orderId: "order_9", reused: true });
    expect(d.calls.create).toBe(0);
  });

  it("creates once and saves the id on the happy path", async () => {
    const d = deps();
    const r = await obtainCheckoutOrder(payment(), d);
    expect(r).toMatchObject({ orderId: "order_1", reused: false });
    expect(d.calls.saved).toEqual(["order_1"]);
    expect(d.calls.ambiguous).toEqual([]);
  });

  it("a lost provider response marks the payment ambiguous and fails closed", async () => {
    const d = deps();
    d.createOrder = async () => { throw new Error("network"); };
    await expect(obtainCheckoutOrder(payment(), d)).rejects.toBeInstanceOf(CheckoutOrderError);
    expect(d.calls.ambiguous).toEqual([true]);
    expect(d.calls.saved).toEqual([]);
  });

  it("ambiguous + provider has the order: adopts it, clears the flag, creates nothing", async () => {
    const d = deps();
    d.findOrderByReceipt = async () => ({ id: "order_found", amount: 90000, currency: "INR" });
    const r = await obtainCheckoutOrder(payment({ orderAmbiguous: true }), d);
    expect(r).toMatchObject({ orderId: "order_found", reused: true });
    expect(d.calls.create).toBe(0);
    expect(d.calls.saved).toEqual(["order_found"]);
    expect(d.calls.ambiguous).toEqual([false]);
  });

  it("ambiguous + provider has no order: clears and creates fresh", async () => {
    const d = deps();
    const r = await obtainCheckoutOrder(payment({ orderAmbiguous: true }), d);
    expect(r.reused).toBe(false);
    expect(d.calls.ambiguous).toEqual([false]);
    expect(d.calls.create).toBe(1);
  });

  it("ambiguous + provider unreachable: stays closed, creates nothing", async () => {
    const d = deps();
    d.findOrderByReceipt = async () => { throw new Error("down"); };
    await expect(obtainCheckoutOrder(payment({ orderAmbiguous: true }), d)).rejects.toMatchObject({ code: "ambiguous" });
    expect(d.calls.create).toBe(0);
    expect(d.calls.ambiguous).toEqual([]);
  });

  it("ambiguous + provider order with a different amount: stays closed", async () => {
    const d = deps();
    d.findOrderByReceipt = async () => ({ id: "order_x", amount: 1, currency: "INR" });
    await expect(obtainCheckoutOrder(payment({ orderAmbiguous: true }), d)).rejects.toMatchObject({ code: "ambiguous" });
    expect(d.calls.create).toBe(0);
  });
});

describe("cancel restore with a refunded gift payment", () => {
  const booking = { id: "b1", tenantId: "t", studioId: "s1", membershipId: null, giftId: "g1", membershipWashUsed: false } as never;
  const seedData = (gift: Record<string, unknown>, payment?: Record<string, unknown>) => ({
    gifts: { g1: { id: "g1", status: "REDEEMED", bookingId: "b1", ...gift } },
    payments: payment ? { pay1: { id: "pay1", giftId: "g1", status: "completed", refundedAt: null, razorpayRefundId: null, ...payment } } : {},
    pickupRequests: {},
    memberships: {},
  });

  it("restores an unredeemed-value gift when its payment was never refunded", async () => {
    const { db: db2, data: d2 } = fakeFirestore(seedData({}, { status: "completed" }) as never);
    await (db2 as never as { runTransaction: (f: (tx: never) => Promise<void>) => Promise<void> }).runTransaction(async (tx) => {
      const reads = await readCancelReads(tx, db2 as never, booking, "b1");
      writeCancelRestores(tx, reads, booking, "b1", user("admin1"), T, "test", false);
    });
    expect(d2["gifts"]!["g1"]).toMatchObject({ status: "ACTIVE", redeemedBy: null, bookingId: null });
  });

  it.each([
    ["status refunded", { status: "refunded" }],
    ["refundedAt set", { refundedAt: T }],
    ["razorpayRefundId set", { razorpayRefundId: "rfnd_1" }],
  ])("never revives the credit when the payment was refunded (%s)", async (_label, payPatch) => {
    const { db, data } = fakeFirestore(seedData({}, payPatch) as never);
    await (db as never as { runTransaction: (f: (tx: never) => Promise<void>) => Promise<void> }).runTransaction(async (tx) => {
      const reads = await readCancelReads(tx, db as never, booking, "b1");
      writeCancelRestores(tx, reads, booking, "b1", user("admin1"), T, "test", false);
    });
    expect(data["gifts"]!["g1"]!["status"]).toBe("REFUNDED");
    expect(data["gifts"]!["g1"]!["voidReason"]).toBe("Payment refunded");
  });
});

import type * as RazorpayCheckout from "../../lib/razorpay-checkout.js";
import { it, expect, beforeAll, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { createHmac } from "node:crypto";
process.env["USE_PAYMENT_MOCK"] = "true";
const h = vi.hoisted(() => ({ enabled: true, createOrder: vi.fn(async (p: {amount: number; currency: string; receipt: string}) => ({ id: `web-order-${p.receipt}`, amount: p.amount, currency: p.currency })), findOrder: vi.fn(async (_receipt: string): Promise<{ id: string; amount: number; currency: string } | null> => null) }));
vi.mock("../../lib/razorpay-checkout.js", async orig => {
  const m = await orig<typeof RazorpayCheckout>();
  return { ...m, createRazorpayOrder: (p: {amount: number; currency: string; receipt: string}) => h.createOrder(p), findRazorpayOrderByReceipt: (p: {receipt: string}) => h.findOrder(p.receipt) };
});
vi.mock("../../lib/gift-payment-gate.js", () => ({ nativeGiftPaymentEnabled: () => h.enabled }));
import { requestGiftPaymentLink } from "../../functions/payment/requestGiftPaymentLink.js";
import { createCheckoutOrder } from "../../functions/payment/createCheckoutOrder.js";
import { createGiftPurchase } from "../../lib/gift-purchase.js";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
const db = getFirestore();
beforeAll(() => { if (!process.env["FIRESTORE_EMULATOR_HOST"] || !process.env["GCLOUD_PROJECT"]?.startsWith("demo-")) throw new Error("demo emulator required"); });
let n = 0;
const auth = (uid: string, tenantId = "gift-native", role = "customer") => ({ uid, token: { role, tenantId, studioId: null } });
async function seed() {
  const uid = `gift-native-${Date.now()}-${n++}`;
  const r = await createGiftPurchase(db, { uid, claims: { role: "customer", tenantId: "gift-native", studioId: null }, phone: null, email: null, displayName: null } as never, 90000);
  return { ...r, uid };
}
async function link(s: Awaited<ReturnType<typeof seed>>) { return await requestGiftPaymentLink.run({ data: { paymentId: s.paymentId }, auth: auth(s.uid) } as never) as { paymentUrl: string; status: string }; }
async function capture(s: Awaited<ReturnType<typeof seed>>, suffix = "") {
  const p = (await db.collection("payments").doc(s.paymentId).get()).data()!;
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: `pay-${s.paymentId}`, order_id: p.razorpayOrderId, amount: p.amount, currency: "INR", status: "captured" } } } });
  const secret = "local-gift-signature", provider = new RazorpayProvider("local-test", "unused", secret);
  expect(provider.verifyWebhookSignature({ rawBody: raw, signature: createHmac("sha256", secret).update(raw).digest("hex") })).toBe(true);
  const ev = provider.parseWebhookEvent(raw); ev.providerEventId = `gift-event-${s.paymentId}${suffix}`;
  return processProviderEvent(db, ev);
}
it("default-inert gate and buyer/tenant/role/schema walls precede provider work", async () => {
  const s = await seed(); h.enabled = false; await expect(link(s)).rejects.toThrow(/not enabled/); h.enabled = true;
  for (const a of [auth("wrong"), auth(s.uid, "wrong"), auth(s.uid, "gift-native", "staff"), auth(s.uid, "gift-native", "admin"), auth(s.uid, "gift-native", "studio")]) await expect(requestGiftPaymentLink.run({ data: { paymentId: s.paymentId }, auth: a } as never)).rejects.toThrow();
  await expect(requestGiftPaymentLink.run({ data: { paymentId: s.paymentId, amount: 1 }, auth: auth(s.uid) } as never)).rejects.toThrow();
  expect((await db.collection("payments").doc(s.paymentId).get()).data()!.razorpayPaymentLinkId).toBeNull();
});
it("real gift/payment, same deterministic link replay, locally signed capture activates once; duplicate no-op", async () => {
  const s = await seed(); const first = await link(s); expect(first.paymentUrl).toContain(`/${s.paymentId}?amount=90000`); expect(await link(s)).toEqual(first);
  expect((await db.collection("gifts").doc(s.giftId).get()).data()!.status).toBe("PENDING_PAYMENT");
  expect((await capture(s)).outcome).toBe("completed"); expect((await capture(s)).outcome).toBe("duplicate");
  const g = (await db.collection("gifts").doc(s.giftId).get()).data()!; expect(g.status).toBe("ACTIVE"); expect(g.paymentId).toBe(s.paymentId); expect(g.expiresAt).toBeTruthy();
  await expect(link(s)).rejects.toThrow();
});
it.each(["VOID", "REFUNDED", "REDEEMED", "ACTIVE"])("never opens a %s gift", async status => { const s = await seed(); await db.collection("gifts").doc(s.giftId).update({ status }); await expect(link(s)).rejects.toThrow(); });
it("late capture on cancelled gift records money but does not revive it, and creates review alert", async () => {
  const s = await seed(); await link(s); await db.collection("gifts").doc(s.giftId).update({ status: "VOID" });
  expect((await capture(s)).outcome).toBe("completed"); expect((await db.collection("gifts").doc(s.giftId).get()).data()!.status).toBe("VOID");
  expect((await db.collection("payments").doc(s.paymentId).get()).data()!.invoiceReviewNeeded).toBe(true);
  expect((await db.collection("staffAlerts").doc(`gift_capture_review_${s.paymentId}`).get()).exists).toBe(true);
});
it("native route cannot create over a reserved Standard Checkout lane, and Standard Checkout rejects bound native lane", async () => {
  const s = await seed(); await db.collection("payments").doc(s.paymentId).update({ linkCreateLeaseId: "gift-standard-checkout" }); await expect(link(s)).rejects.toThrow(/checkout in progress/);
  const native = await seed(); await link(native);
  process.env["RAZORPAY_KEY_ID"] = "local"; process.env["RAZORPAY_KEY_SECRET"] = "local";
  await expect(createCheckoutOrder.run({ data: { paymentId: native.paymentId }, auth: auth(native.uid) } as never)).rejects.toThrow(/another checkout/);
  delete process.env["RAZORPAY_KEY_ID"]; delete process.env["RAZORPAY_KEY_SECRET"];
});

it("concurrent native retries bind one provider reference only", async () => {
  const s = await seed(); const results = await Promise.allSettled([link(s), link(s)]);
  expect(results.some(r => r.status === "fulfilled")).toBe(true);
  const p = (await db.collection("payments").doc(s.paymentId).get()).data()!;
  expect(p.razorpayPaymentLinkId).toBe(`mock_plink_${s.paymentId}`); expect(p.orderAmbiguous).toBe(false);
  expect((await db.collection("payments").where("giftId", "==", s.giftId).get()).size).toBe(1);
}, 90_000);

it("plain web gift checkout replays the same order and persistent lane", async () => {
  const s = await seed(); process.env["RAZORPAY_KEY_ID"] = "local"; process.env["RAZORPAY_KEY_SECRET"] = "local";
  h.createOrder.mockClear();
  const req = { data: { paymentId: s.paymentId }, auth: auth(s.uid) };
  const first = await createCheckoutOrder.run(req as never);
  expect(await createCheckoutOrder.run(req as never)).toEqual(first);
  expect(h.createOrder).toHaveBeenCalledTimes(1);
  expect((await db.collection("payments").doc(s.paymentId).get()).data()!.linkCreateLeaseId).toBe("gift-standard-checkout");
  await expect(link(s)).rejects.toThrow(/checkout in progress/);
  expect((await capture(s)).outcome).toBe("completed");
  expect((await db.collection("gifts").doc(s.giftId).get()).data()!.status).toBe("ACTIVE");
  delete process.env["RAZORPAY_KEY_ID"]; delete process.env["RAZORPAY_KEY_SECRET"];
});
it("same web gift retries after provider failure through receipt reconciliation, without native lane escape", async () => {
  const s = await seed(); process.env["RAZORPAY_KEY_ID"] = "local"; process.env["RAZORPAY_KEY_SECRET"] = "local";
  h.createOrder.mockClear(); h.findOrder.mockClear(); h.createOrder.mockRejectedValueOnce(new Error("response lost"));
  const req = { data: { paymentId: s.paymentId }, auth: auth(s.uid) };
  await expect(createCheckoutOrder.run(req as never)).rejects.toThrow(/Could not start/);
  expect((await db.collection("payments").doc(s.paymentId).get()).data()!.orderAmbiguous).toBe(true);
  expect(await link(s)).toMatchObject({ status: "manual_review", paymentUrl: null });
  h.findOrder.mockResolvedValueOnce({ id: `recovered-${s.paymentId}`, amount: 90000, currency: "INR" });
  expect(await createCheckoutOrder.run(req as never)).toMatchObject({ orderId: `recovered-${s.paymentId}` });
  expect(h.createOrder).toHaveBeenCalledTimes(1); expect(h.findOrder).toHaveBeenCalledWith(s.paymentId);
  expect(await createCheckoutOrder.run(req as never)).toMatchObject({ orderId: `recovered-${s.paymentId}` });
  expect(h.createOrder).toHaveBeenCalledTimes(1);
  delete process.env["RAZORPAY_KEY_ID"]; delete process.env["RAZORPAY_KEY_SECRET"];
});

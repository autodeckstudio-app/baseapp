/**
 * TEST. The actual HTTP entry (razorpayWebhook) against the real Firestore emulator with a REAL RazorpayProvider (signature check on).
 * Only the provider factory is swapped for one with a local test secret; the fixture events are signed locally. No network, no provider config.
 */
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";

const SECRET = "whsec_local_test";
vi.mock("../../lib/razorpay-provider.js", async (orig) => {
  const m = await orig<typeof import("../../lib/razorpay-provider.js")>();
  return { ...m, getPaymentProvider: () => new m.RazorpayProvider("rzp_test_x", "k", SECRET) };
});
import { razorpayWebhook } from "../../functions/payment/razorpayWebhook.js";
import { reserveRefund } from "../../lib/refund-outbox.js";

const db = getFirestore();
let n = 0;
const sign = (raw: string) => createHmac("sha256", SECRET).update(raw).digest("hex");
async function call(raw: string, o: { sig?: string; eid: string; method?: string }) {
  const headers: Record<string, string> = { "x-razorpay-signature": o.sig ?? sign(raw), "x-razorpay-event-id": o.eid };
  const req = { method: o.method ?? "POST", rawBody: Buffer.from(raw), header: (k: string) => headers[k.toLowerCase()] } as never;
  let status = 0; let body: unknown;
  const res = { status(c: number) { status = c; return res; }, send(b: unknown) { body = b; return res; }, json(b: unknown) { body = b; return res; } } as never;
  await (razorpayWebhook as unknown as (a: unknown, b: unknown) => Promise<void>)(req, res);
  return { status, body: body as { outcome?: string } };
}
async function seed() {
  n += 1; const id = `${Date.now()}${n}`, pid = `hpay${id}`, bid = `hb${id}`, pay = `pay_h${id}`;
  const p = { id: pid, tenantId: "h-t", studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c", amount: 50000, currency: "INR",
    status: "completed", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
  await db.collection("payments").doc(pid).set(p as object);
  await db.collection("bookings").doc(bid).set({ id: bid, tenantId: "h-t", paymentStatus: "paid" });
  const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
  const body = (rid: string, receipt: string | null) => JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: rid, payment_id: pay, amount: 50000, currency: "INR", status: "processed", receipt } } } });
  return { pid, bid, requestId, body };
}

describe("razorpayWebhook HTTP entry (real emulator, signature on)", () => {
  it("invalid or missing signature: 401, nothing recorded", async () => {
    const s = await seed(); const raw = s.body("rfnd_x", s.requestId);
    expect((await call(raw, { sig: "deadbeef", eid: "HI1" + s.pid })).status).toBe(401);
    expect((await call(raw, { sig: "", eid: "HI2" + s.pid })).status).toBe(401);
    expect((await db.collection("paymentEvents").doc("HI1" + s.pid).get()).exists).toBe(false);
    expect((await call(raw, { eid: "HI3" + s.pid, method: "GET" })).status).toBe(405);
  });
  it("pending: 200 (no 503) and no event record; after projection the SAME signed event returns 200 refund_processed, then 200 duplicate", async () => {
    const { runRefundOutbox } = await import("../../lib/refund-outbox.js");
    const s = await seed(); const raw = s.body("rfnd_http_" + s.pid, s.requestId); const eid = "HP" + s.pid;
    const r1 = await call(raw, { eid });
    expect(r1.status).toBe(200); expect(r1.body.outcome).toBe("pending_correlation");
    expect((await db.collection("paymentEvents").doc(eid).get()).exists).toBe(false);
    await runRefundOutbox(db, { initiateRefund: async () => ({ providerRefundId: "rfnd_http_" + s.pid }) } as never);
    const r2 = await call(raw, { eid });
    expect(r2.status).toBe(200); expect(r2.body.outcome).toBe("refund_processed");
    expect((await db.collection("bookings").doc(s.bid).get()).data()!["refundStatus"]).toBe("processed");
    const r3 = await call(raw, { eid });
    expect(r3.status).toBe(200); expect(r3.body.outcome).toBe("duplicate");
  });
  it("explicit conflict: 200 (terminal) refund_unmatched, no booking write", async () => {
    const s = await seed();
    const r = await call(s.body("rfnd_c", "rr_other_request"), { eid: "HC" + s.pid });
    expect(r.status).toBe(200); expect(r.body.outcome).toBe("refund_unmatched");
    expect((await db.collection("bookings").doc(s.bid).get()).data()!["refundStatus"]).toBeUndefined();
  });
  it("an ignored event type still returns 200", async () => {
    const r = await call(JSON.stringify({ event: "refund.speed_changed", payload: {} }), { eid: "HS" + Date.now() });
    expect(r.status).toBe(200); expect(r.body.outcome).toBe("ignored");
  });
});

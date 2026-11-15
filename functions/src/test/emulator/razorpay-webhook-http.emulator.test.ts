import type * as RazorpayProviderModule from "../../lib/razorpay-provider.js";
/**
 * TEST. The actual HTTP entry (razorpayWebhook) against the real Firestore emulator with a REAL RazorpayProvider (signature check on).
 * Only the provider factory is swapped for one with a local test secret; the fixture events are signed locally. No network, no provider config.
 */
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";

const SECRET = "whsec_local_test";
vi.mock("../../lib/razorpay-provider.js", async (orig) => {
  const m = await orig<typeof RazorpayProviderModule>();
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
  it("outbox-owned refund event before projection: 200 outbox_owned, recorded, and projected through the outbox (never the generic path); replay is a 200 duplicate", async () => {
    // Contract: 5205613d (25 Oct) - an outbox-owned refund event is "recorded but never generically projected";
    // money moves only through the outbox projection on exact provider "processed" evidence (was pending_correlation,
    // no event record, replay re-projected).
    const { runRefundOutbox } = await import("../../lib/refund-outbox.js");
    const s = await seed(); const raw = s.body("rfnd_http_" + s.pid, s.requestId); const eid = "HP" + s.pid;
    const r1 = await call(raw, { eid });
    expect(r1.status).toBe(200); expect(r1.body.outcome).toBe("outbox_owned");
    expect((await db.collection("paymentEvents").doc(eid).get()).exists).toBe(true);
    await runRefundOutbox(db, { initiateRefund: async () => ({ providerRefundId: "rfnd_http_" + s.pid }) } as never);
    expect((await db.collection("bookings").doc(s.bid).get()).data()!["refundStatus"]).toBe("processed");
    const r3 = await call(raw, { eid });
    expect(r3.status).toBe(200); expect(r3.body.outcome).toBe("duplicate");
  });
  it("explicit conflict: 200 (terminal) ownership_mismatch, no booking write", async () => {
    // Contract: 5205613d (25 Oct) - an rr_-namespaced receipt with no persisted request is recognised ownership
    // evidence with a missing binding: recorded as ownership_mismatch, held, zero writes (was refund_unmatched).
    const s = await seed();
    const r = await call(s.body("rfnd_c", "rr_other_request"), { eid: "HC" + s.pid });
    expect(r.status).toBe(200); expect(r.body.outcome).toBe("ownership_mismatch");
    expect((await db.collection("bookings").doc(s.bid).get()).data()!["refundStatus"]).toBeUndefined();
  });
  it("an ignored event type still returns 200", async () => {
    const r = await call(JSON.stringify({ event: "refund.speed_changed", payload: {} }), { eid: "HS" + Date.now() });
    expect(r.status).toBe(200); expect(r.body.outcome).toBe("ignored");
  });
});

// TEST signed HTTP fixture for the NEW waiting branch, using real HMAC verification and emulator state.
it("waiting cancellation: signed documented link capture cancels ONLY with full reservation", async () => {
 const id=`httpwait-${Date.now()}`, now=new Date().toISOString();
 await db.collection("bookings").doc(id).set({id,tenantId:"h-w",studioId:"s",customerId:"c",status:"PENDING",cancelIntent:{state:"waiting",requestedAt:now}});
 await db.collection("jobs").doc(id).set({id,tenantId:"h-w",studioId:"s",customerId:"c",bookingId:id,status:"PENDING_VEHICLE",statusHistory:[]});
 await db.collection("payments").doc(id).set({id,tenantId:"h-w",studioId:"s",customerId:"c",bookingId:id,jobId:id,status:"pending",method:"razorpay_payment_link",razorpayPaymentLinkId:`plink_${id}`,razorpayPaymentId:null,amount:50000,currency:"INR"});
 await db.collection("bookingCancelIntents").doc(id).set({bookingId:id,tenantId:"h-w",studioId:"s",customerId:"c",jobId:id,paymentId:id,state:"waiting",requestedAt:now,requestedBy:"c",reason:"fixture",reviewAt:now});
 const raw=JSON.stringify({event:"payment_link.paid",payload:{payment_link:{entity:{id:`plink_${id}`,reference_id:id,amount:50000,amount_paid:50000,currency:"INR",status:"paid"}},payment:{entity:{id:`pay_${id}`,amount:50000,currency:"INR",status:"captured"}}}});
 expect((await call(raw,{eid:`ev_${id}`})).status).toBe(200);
 expect((await db.collection("bookings").doc(id).get()).data()).toMatchObject({status:"CANCELLED",refundStatus:"reserved"});
 const rr=await db.collection("refundRequests").where("paymentId","==",id).get();expect(rr.docs.filter(d=>d.id.startsWith("rr_")).map(d=>d.data().amountPaise)).toEqual([50000]);
});

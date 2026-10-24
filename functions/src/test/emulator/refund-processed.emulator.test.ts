/**
 * TEST. refund.processed local projection (real Firestore emulator; Razorpay events are local fixtures, no provider call).
 * A match sets booking.refundStatus "processed" only. Missing/mismatched = no booking or payment write + private alert.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";

const db = getFirestore();
const provider = new RazorpayProvider("rzp_test_x", "secret", "whsec_test");
let n = 0;
const T = "rp-tenant";
const evt = (type: string, eid: string, o: { pay: string; rid: string; amt: number; cur?: string }) => {
  const e = provider.parseWebhookEvent(JSON.stringify({ event: type, payload: {
    payment: { entity: { id: o.pay, amount: 50000, currency: o.cur ?? "INR" } },
    refund: { entity: { id: o.rid, payment_id: o.pay, amount: o.amt } } } }));
  e.providerEventId = eid; return e;
};
async function seed(over: { bookingRefundStatus?: string; reqRid?: string | null; payRid?: string; reqAmt?: number; bookingTenant?: string; payStatus?: string } = {}) {
  n += 1; const id = `${Date.now()}${n}`;
  const pid = `rppay${id}`, bid = `rpb${id}`, rid = `rfnd_${id}`, pay = `pay_${id}`;
  await db.collection("payments").doc(pid).set({ id: pid, tenantId: T, studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c",
    amount: 50000, currency: "INR", status: over.payStatus ?? "refunded", razorpayPaymentId: pay, razorpayRefundId: over.payRid ?? rid, refundAmount: 50000 });
  await db.collection("bookings").doc(bid).set({ id: bid, tenantId: over.bookingTenant ?? T, refundStatus: over.bookingRefundStatus ?? "initiated", paymentStatus: "refunded" });
  if (over.reqRid !== null) await db.collection("refundRequests").doc(`rr_${id}`).set({ id: `rr_${id}`, tenantId: T, paymentId: pid, bookingId: bid,
    amountPaise: over.reqAmt ?? 50000, status: "projected", providerRefundId: over.reqRid ?? rid });
  return { pid, bid, rid, pay };
}
const booking = async (b: string) => (await db.collection("bookings").doc(b).get()).data()!;
const payment = async (p: string) => (await db.collection("payments").doc(p).get()).data()!;
const alerts = async (pid: string) => (await db.collection("staffAlerts").where("paymentId", "==", pid).get()).docs.map((d) => d.data());

describe("refund.processed projection (emulator)", () => {
  it("exact match: booking processed; payment untouched; redelivery is a duplicate", async () => {
    const s = await seed(); const before = await payment(s.pid);
    const e = evt("refund.processed", "EP" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 });
    expect((await processProviderEvent(db, e)).outcome).toBe("refund_processed");
    const b = await booking(s.bid);
    expect(b["refundStatus"]).toBe("processed"); expect(b["paymentStatus"]).toBe("refunded");
    expect(await payment(s.pid)).toEqual(before);
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    // a second event id for the same refund changes nothing further
    expect((await processProviderEvent(db, evt("refund.processed", "EP2" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("already_final");
    expect(await alerts(s.pid)).toHaveLength(0);
  });
  it("admin-cancel shape (booking.refundId + refundedPaise, no request doc) matches", async () => {
    const s = await seed({ reqRid: null });
    await db.collection("bookings").doc(s.bid).update({ refundId: s.rid, refundedPaise: 50000 });
    expect((await processProviderEvent(db, evt("refund.processed", "EA" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("refund_processed");
  });
  const cases: Array<[string, Parameters<typeof seed>[0], { rid?: string; amt?: number; cur?: string }]> = [
    ["refund id differs from stored", {}, { rid: "rfnd_other" }],
    ["amount differs", {}, { amt: 100 }],
    ["currency differs", {}, { cur: "USD" }],
    ["no stored refund request or booking refund id", { reqRid: null }, {}],
    ["booking tenant differs", { bookingTenant: "other" }, {}],
    ["payment stored refund id differs", { payRid: "rfnd_x" }, {}],
  ];
  for (const [name, seedOver, evOver] of cases) {
    it(`${name}: NO booking/payment write, private alert`, async () => {
      const s = await seed(seedOver); const bb = await booking(s.bid); const pb = await payment(s.pid);
      const r = await processProviderEvent(db, evt("refund.processed", "EM" + s.pid, { pay: s.pay, rid: evOver.rid ?? s.rid, amt: evOver.amt ?? 50000, cur: evOver.cur }));
      expect(r.outcome).toBe("refund_unmatched");
      expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
      const a = await alerts(s.pid); expect(a).toHaveLength(1); expect(a[0]).toMatchObject({ kind: "refund_processed_unmatched", tenantId: T });
    });
  }
  it("unknown payment: no write; failed booking status is never upgraded by processed", async () => {
    expect((await processProviderEvent(db, evt("refund.processed", "EU" + Date.now(), { pay: "pay_nope", rid: "rfnd_nope", amt: 1 }))).outcome).toBe("unknown_payment");
    const s = await seed({ bookingRefundStatus: "failed" });
    expect((await processProviderEvent(db, evt("refund.processed", "EF" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("refund_unmatched");
    expect((await booking(s.bid))["refundStatus"]).toBe("failed");
  });
  it("out of order: processed first, then refund.created does not regress it", async () => {
    const s = await seed();
    await processProviderEvent(db, evt("refund.processed", "EO" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }));
    const r = await processProviderEvent(db, evt("refund.created", "EC" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }));
    expect(r.outcome).toBe("already_final");
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
  });
});

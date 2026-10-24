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
const evt = (type: string, eid: string, o: { pay: string; rid: string; amt: number; cur?: string | undefined }) => {
  const e = provider.parseWebhookEvent(JSON.stringify({ event: type, payload: {
    payment: { entity: { id: o.pay, amount: 90000, currency: "INR" } }, // official shape: payment.amount is the PAYMENT amount, not the refund amount
    refund: { entity: { id: o.rid, payment_id: o.pay, amount: o.amt, currency: o.cur ?? "INR", status: "processed" } } } }));
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

  // Fail-closed identity/shape guards: raw payloads built by hand so fields can be conflicting or absent.
  const raw = (eid: string, pay: string, rid: string, o: { payEntityId?: string | null; payEntityCur?: string | null; refund?: Record<string, unknown> }) => {
    const refund: Record<string, unknown> = { id: rid, payment_id: pay, amount: 50000, currency: "INR", status: "processed", ...(o.refund ?? {}) };
    for (const k of Object.keys(refund)) if (refund[k] === undefined) delete refund[k];
    const payload: Record<string, unknown> = { refund: { entity: refund } };
    if (o.payEntityId !== null) payload["payment"] = { entity: { id: o.payEntityId ?? pay, amount: 90000, ...(o.payEntityCur === null ? {} : { currency: o.payEntityCur ?? "INR" }) } };
    const e = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload })); e.providerEventId = eid; return e;
  };
  const guards: Array<[string, (pay: string) => { payEntityId?: string | null; payEntityCur?: string | null; refund?: Record<string, unknown> }]> = [
    ["payment entity id conflicts with refund.payment_id", () => ({ payEntityId: "pay_other" })],
    ["payment entity currency conflicts with refund currency", () => ({ payEntityCur: "USD" })],
    ["refund currency missing", () => ({ refund: { currency: undefined } })],
    ["refund amount missing", () => ({ refund: { amount: undefined } })],
    ["refund.payment_id missing", () => ({ refund: { payment_id: undefined } })],
    ["refund status not processed", () => ({ refund: { status: "failed" } })],
    ["refund id missing", () => ({ refund: { id: undefined } })],
  ];
  for (const [name, mk] of guards) {
    it(`fail closed: ${name}`, async () => {
      const s = await seed(); const bb = await booking(s.bid); const pb = await payment(s.pid);
      const r = await processProviderEvent(db, raw("EG" + s.pid, s.pay, s.rid, mk(s.pay)));
      expect(["refund_unmatched", "unknown_payment"]).toContain(r.outcome);
      expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
    });
  }
  it("refund-entity-only payload (no payment entity) with every field present still matches", async () => {
    const s = await seed();
    expect((await processProviderEvent(db, raw("EN" + s.pid, s.pay, s.rid, { payEntityId: null }))).outcome).toBe("refund_processed");
  });
});

describe("RESERVED refund.created binding (real emulator)", () => {
  async function reserved(amt: number) {
    const { reserveRefund: rr } = await import("../../lib/refund-outbox.js");
    n += 1; const id = `${Date.now()}${n}`; const pid = `rcpay${id}`, pay = `pay_rc${id}`;
    const p = { id: pid, tenantId: T, studioId: null, targetType: "job", jobId: null, bookingId: null, customerId: "c", amount: 100000, currency: "INR",
      status: "completed", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
    await db.collection("payments").doc(pid).set(p as object);
    const { requestId } = await rr(db, { payment: p, amountPaise: amt, reason: "x", createdBy: "a1" });
    return { pid, pay, requestId };
  }
  const created = (eid: string, pay: string, rid: string, amt: number | undefined, cur: string | undefined, payAmt = 100000) => {
    const refund: Record<string, unknown> = { id: rid, payment_id: pay, ...(amt === undefined ? {} : { amount: amt }), ...(cur === undefined ? {} : { currency: cur }) };
    const e = provider.parseWebhookEvent(JSON.stringify({ event: "refund.created", payload: { refund: { entity: refund }, payment: { entity: { id: pay, amount: payAmt, currency: "INR" } } } }));
    e.providerEventId = eid; return e;
  };
  const reqStatus = async (id: string) => (await db.collection("refundRequests").doc(id).get()).data()!["status"];
  it("partial (30000 < captured 100000) is accepted; redelivery duplicate; payment untouched", async () => {
    const s = await reserved(30000); const before = await payment(s.pid);
    const e = created("RC" + s.pid, s.pay, "rfnd_a" + s.pid, 30000, "INR");
    expect((await processProviderEvent(db, e)).outcome).toBe("refund_accepted");
    expect(await reqStatus(s.requestId)).toBe("accepted");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    expect(await payment(s.pid)).toEqual(before);
  });
  it("currency mismatch, missing amount, missing refund id, amount = payment amount (wrong binding): rejected, request stays reserved", async () => {
    const s = await reserved(30000);
    for (const [i, e] of [
      created("RX1" + s.pid, s.pay, "rfnd_b", 30000, "USD"),
      created("RX2" + s.pid, s.pay, "rfnd_b", undefined, "INR"),
      created("RX3" + s.pid, s.pay, "", 30000, "INR"),
      created("RX4" + s.pid, s.pay, "rfnd_b", 100000, "INR"),
    ].entries()) {
      expect((await processProviderEvent(db, e)).outcome, `case ${i}`).toBe("amount_mismatch");
    }
    expect(await reqStatus(s.requestId)).toBe("reserved");
  });
  it("order: created accepted, then a processed event before projection does not write the booking or payment (unmatched, private alert)", async () => {
    const s = await reserved(30000); const before = await payment(s.pid);
    await processProviderEvent(db, created("RO1" + s.pid, s.pay, "rfnd_c" + s.pid, 30000, "INR"));
    const pe = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_c" + s.pid, payment_id: s.pay, amount: 30000, currency: "INR", status: "processed" } } } }));
    pe.providerEventId = "RO2" + s.pid;
    expect((await processProviderEvent(db, pe)).outcome).toBe("refund_unmatched");
    expect(await payment(s.pid)).toEqual(before);
    expect(await alerts(s.pid)).toHaveLength(1);
  });
});

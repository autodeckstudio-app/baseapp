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
  const created = (eid: string, pay: string, rid: string, amt: number | undefined, cur: string | undefined, payAmt = 100000, receipt?: string) => {
    const refund: Record<string, unknown> = { id: rid, payment_id: pay, ...(receipt ? { receipt } : {}), ...(amt === undefined ? {} : { amount: amt }), ...(cur === undefined ? {} : { currency: cur }) };
    const e = provider.parseWebhookEvent(JSON.stringify({ event: "refund.created", payload: { refund: { entity: refund }, payment: { entity: { id: pay, amount: payAmt, currency: "INR" } } } }));
    e.providerEventId = eid; return e;
  };
  const reqStatus = async (id: string) => (await db.collection("refundRequests").doc(id).get()).data()!["status"];
  it("partial (30000 < captured 100000) is accepted; redelivery duplicate; payment untouched", async () => {
    const s = await reserved(30000); const before = await payment(s.pid);
    const e = created("RC" + s.pid, s.pay, "rfnd_a" + s.pid, 30000, "INR", 100000, s.requestId);
    expect((await processProviderEvent(db, e)).outcome).toBe("refund_accepted");
    expect(await reqStatus(s.requestId)).toBe("accepted");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    expect(await payment(s.pid)).toEqual(before);
  });
  it("currency mismatch, missing amount, missing refund id, amount = payment amount (wrong binding): rejected, request stays reserved", async () => {
    const s = await reserved(30000);
    for (const [i, e] of [
      created("RX1" + s.pid, s.pay, "rfnd_b", 30000, "USD", 100000, s.requestId),
      created("RX2" + s.pid, s.pay, "rfnd_b", undefined, "INR", 100000, s.requestId),
      created("RX3" + s.pid, s.pay, "", 30000, "INR", 100000, s.requestId),
      created("RX4" + s.pid, s.pay, "rfnd_b", 100000, "INR", 100000, s.requestId),
    ].entries()) {
      expect((await processProviderEvent(db, e)).outcome, `case ${i}`).toBe("amount_mismatch");
    }
    expect(await reqStatus(s.requestId)).toBe("reserved");
  });
  it("order: created accepted, then a processed event before projection does not write the booking or payment (unmatched, private alert)", async () => {
    const s = await reserved(30000); const before = await payment(s.pid);
    await processProviderEvent(db, created("RO1" + s.pid, s.pay, "rfnd_c" + s.pid, 30000, "INR", 100000, s.requestId));
    const pe = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_c" + s.pid, payment_id: s.pay, amount: 30000, currency: "INR", status: "processed" } } } }));
    pe.providerEventId = "RO2" + s.pid;
    expect((await processProviderEvent(db, pe)).outcome).toBe("refund_unmatched");
    expect(await payment(s.pid)).toEqual(before);
    expect(await alerts(s.pid)).toHaveLength(1);
  });
});

describe("refund.processed BEFORE the outbox projection (real emulator, real runner)", () => {
  const fixed = (rid: string) => ({ initiateRefund: async () => ({ providerRefundId: rid }) }) as never;
  async function setup() {
    const { reserveRefund, runRefundOutbox } = await import("../../lib/refund-outbox.js");
    n += 1; const id = `${Date.now()}${n}`; const pid = `rbpay${id}`, bid = `rbb${id}`, pay = `pay_rb${id}`, rid = `rfnd_rb${id}`;
    const p = { id: pid, tenantId: T, studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c", amount: 50000, currency: "INR",
      status: "completed", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
    await db.collection("payments").doc(pid).set(p as object);
    await db.collection("bookings").doc(bid).set({ id: bid, tenantId: T, paymentStatus: "paid" });
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const ev = (eid: string, r = rid, receipt: string | null = requestId) => {
      const e = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: r, payment_id: pay, amount: 50000, currency: "INR", status: "processed", receipt } } } }));
      e.providerEventId = eid; return e;
    };
    return { pid, bid, rid, requestId, ev, run: () => runRefundOutbox(db, fixed(rid)) };
  }
  const pendingAlerts = async (pid: string) => (await alerts(pid)).filter((a) => a["kind"] === "refund_event_pending");
  it("pending (nonterminal, no event record, no write) -> same event applies exactly once after projection -> redelivery duplicate", async () => {
    const s = await setup(); const e = s.ev("EB" + s.pid);
    expect((await processProviderEvent(db, e)).outcome).toBe("pending_correlation");
    expect((await db.collection("paymentEvents").doc(e.providerEventId).get()).exists).toBe(false);
    expect((await booking(s.bid))["refundStatus"]).toBeUndefined(); expect((await payment(s.pid))["status"]).toBe("completed");
    expect(await pendingAlerts(s.pid)).toHaveLength(1);
    expect((await processProviderEvent(db, e)).outcome).toBe("pending_correlation"); // retry before projection: still pending, still one alert
    expect(await pendingAlerts(s.pid)).toHaveLength(1);
    await s.run();
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect((await processProviderEvent(db, e)).outcome).toBe("refund_processed");
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
    expect(await pendingAlerts(s.pid)).toHaveLength(0);
    expect((await db.collection("paymentEvents").doc(e.providerEventId).get()).data()!["outcome"]).toBe("refund_processed");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
  });
  it("explicit conflicts before projection are terminal with an alert: other refund id after binding, receipt of another request, wrong amount", async () => {
    const s = await setup();
    expect((await processProviderEvent(db, s.ev("EBc1" + s.pid, s.rid, "rr_other"))).outcome).toBe("refund_unmatched");
    expect((await booking(s.bid))["refundStatus"]).toBeUndefined();
    await s.run();
    expect((await processProviderEvent(db, s.ev("EBc2" + s.pid, "rfnd_foreign"))).outcome).toBe("refund_unmatched");
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect((await payment(s.pid))["razorpayRefundId"]).toBe(s.rid);
  });
  it("foreign refund with no receipt for a payment with no active reservation and nothing projected: conflict, no write", async () => {
    const s = await seed({ reqRid: null, payStatus: "completed", payRid: "" });
    const bb = await booking(s.bid);
    expect((await processProviderEvent(db, evt("refund.processed", "EBf" + s.pid, { pay: s.pay, rid: "rfnd_foreign", amt: 50000 }))).outcome).toBe("refund_unmatched");
    expect(await booking(s.bid)).toEqual(bb);
  });
});

describe("pending re-drive by a later event for the SAME refund (real emulator, real runner)", () => {
  async function pendingSetup(boundRid?: string) {
    const { reserveRefund, runRefundOutbox } = await import("../../lib/refund-outbox.js");
    n += 1; const id = `${Date.now()}${n}`; const pid = `rdpay${id}`, bid = `rdb${id}`, pay = `pay_rd${id}`, rid = `rfnd_rd${id}`;
    const p = { id: pid, tenantId: T, studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c", amount: 50000, currency: "INR",
      status: "completed", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
    await db.collection("payments").doc(pid).set(p as object);
    await db.collection("bookings").doc(bid).set({ id: bid, tenantId: T, paymentStatus: "paid" });
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const mk = (event: string, eid: string, r = rid) => {
      const e = provider.parseWebhookEvent(JSON.stringify({ event, payload: { refund: { entity: { id: r, payment_id: pay, amount: 50000, currency: "INR", status: "processed", receipt: requestId } } } }));
      e.providerEventId = eid; return e;
    };
    const pe = mk("refund.processed", "RDP" + pid);
    expect((await processProviderEvent(db, pe)).outcome).toBe("pending_correlation");
    return { pid, bid, rid, pe, mk, run: () => runRefundOutbox(db, { initiateRefund: async () => ({ providerRefundId: boundRid ?? rid }) } as never) };
  }
  const pendingCount = async (pid: string) => (await alerts(pid)).filter((a) => a["kind"] === "refund_event_pending").length;
  it("later event, same refund, after projection: pending event applies exactly once; alert cleared", async () => {
    const s = await pendingSetup(); await s.run();
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect((await processProviderEvent(db, s.mk("refund.created", "RDC" + s.pid))).outcome).toBe("already_final");
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
    expect((await db.collection("paymentEvents").doc(s.pe.providerEventId).get()).data()!["outcome"]).toBe("refund_processed");
    expect(await pendingCount(s.pid)).toBe(0);
    const at = (await booking(s.bid))["refundProcessedAt"];
    await processProviderEvent(db, s.mk("refund.created", "RDC2" + s.pid)); // another later event: nothing to re-drive
    expect((await booking(s.bid))["refundProcessedAt"]).toBe(at);
  });
  it("later event BEFORE projection leaves it pending; a later event for a DIFFERENT refund id never re-drives it", async () => {
    const s = await pendingSetup();
    await processProviderEvent(db, s.mk("refund.created", "RDe" + s.pid));
    expect(await pendingCount(s.pid)).toBe(1);
    await s.run();
    await processProviderEvent(db, s.mk("refund.created", "RDx" + s.pid, "rfnd_other_refund"));
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect(await pendingCount(s.pid)).toBe(1);
  });
  it("concurrent later events: applied exactly once, no error", async () => {
    const s = await pendingSetup(); await s.run();
    const res = await Promise.all([1, 2, 3].map((i) => processProviderEvent(db, s.mk("refund.created", `RDk${i}` + s.pid))));
    expect(res.every((r) => r.outcome === "already_final")).toBe(true);
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
    expect((await db.collection("paymentEvents").doc(s.pe.providerEventId).get()).data()!["outcome"]).toBe("refund_processed");
    expect(await pendingCount(s.pid)).toBe(0);
  });
  it("re-drive that now conflicts (refund bound to a different id): terminal, alert, no booking/payment write", async () => {
    const s = await pendingSetup("rfnd_bound_elsewhere"); await s.run();
    const pb = await payment(s.pid);
    await processProviderEvent(db, s.mk("refund.created", "RDz" + s.pid));
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect(await payment(s.pid)).toEqual(pb);
    expect((await db.collection("paymentEvents").doc(s.pe.providerEventId).get()).data()!["outcome"]).toBe("refund_unmatched");
    expect(await pendingCount(s.pid)).toBe(0);
    expect((await alerts(s.pid)).filter((a) => a["kind"] === "refund_processed_unmatched")).toHaveLength(1);
  });
  it("scope: a later event on ANOTHER payment (even the same refund id) never touches this pending", async () => {
    const s = await pendingSetup(); await s.run();
    const other = await seed();
    await processProviderEvent(db, evt("refund.created", "RDo" + other.pid, { pay: other.pay, rid: s.rid, amt: 50000 }));
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect(await pendingCount(s.pid)).toBe(1);
  });
  it("no later traffic: stays pending with its alert (no recovery)", async () => {
    const s = await pendingSetup(); await s.run();
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
    expect(await pendingCount(s.pid)).toBe(1);
  });
});

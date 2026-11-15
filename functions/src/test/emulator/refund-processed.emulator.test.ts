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
async function seed(over: { bookingRefundStatus?: string; reqRid?: string | null; payRid?: string; reqAmt?: number; bookingTenant?: string; payStatus?: string; refundAmt?: number | null } = {}) {
  n += 1; const id = `${Date.now()}${n}`;
  const pid = `rppay${id}`, bid = `rpb${id}`, rid = `rfnd_${id}`, pay = `pay_${id}`;
  await db.collection("payments").doc(pid).set({ id: pid, tenantId: T, studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c",
    amount: 50000, currency: "INR", status: over.payStatus ?? "completed", razorpayPaymentId: pay, razorpayRefundId: over.payRid ?? rid, refundAmount: over.refundAmt !== undefined ? over.refundAmt : over.payStatus === "refunded" ? 50000 : null });
  await db.collection("bookings").doc(bid).set({ id: bid, tenantId: over.bookingTenant ?? T, refundStatus: over.bookingRefundStatus ?? "initiated", paymentStatus: "refunded" });
  if (over.reqRid !== null) await db.collection("refundRequests").doc(`rr_${id}`).set({ id: `rr_${id}`, tenantId: T, paymentId: pid, bookingId: bid,
    amountPaise: over.reqAmt ?? 50000, status: "projected", providerRefundId: over.reqRid ?? rid });
  return { pid, bid, rid, pay };
}
const booking = async (b: string) => (await db.collection("bookings").doc(b).get()).data()!;
const payment = async (p: string) => (await db.collection("payments").doc(p).get()).data()!;
const alerts = async (pid: string) => (await db.collection("staffAlerts").where("paymentId", "==", pid).get()).docs.map((d) => d.data());

// CONTRACT for this block (5205613d "webhook: fail-closed ownership binding + refund lifecycle gate", and
// razorpay-webhook.ts "refund.created / refund.processed" path): a webhook may not project money onto a payment that is
// already final. The outbox projection (refund-outbox.ts, one transaction) is the only writer that moves payment to
// "refunded" AND booking.refundStatus to "processed" for an outbox refund; first projection is tested in the
// "real runner" describes below. These fixtures are the HISTORICAL / REPLAY states: payment already "refunded".
// Expected: outcome already_final and ZERO booking/payment/alert writes whatever the event shape (replay, mismatched,
// malformed). Previous expectations (refund_processed / refund_unmatched on a refunded payment) predate 5205613d.
describe("refund.processed against an already-final payment: replay and historical states (emulator)", () => {
  it("replay: payment refunded + booking processed: redelivery and a second event id change nothing", async () => {
    const s = await seed({ payStatus: "refunded", bookingRefundStatus: "processed" });
    const bb = await booking(s.bid); const pb = await payment(s.pid);
    const e = evt("refund.processed", "EP" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 });
    expect((await processProviderEvent(db, e)).outcome).toBe("already_final");
    expect((await processProviderEvent(db, evt("refund.processed", "EP2" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("already_final");
    expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
    expect(await alerts(s.pid)).toHaveLength(0);
  });
  it("historical: payment refunded but booking refundStatus still initiated is NOT upgraded by a webhook (fail closed, zero writes)", async () => {
    const s = await seed({ payStatus: "refunded", bookingRefundStatus: "initiated" });
    const bb = await booking(s.bid); const pb = await payment(s.pid);
    expect((await processProviderEvent(db, evt("refund.processed", "EH" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("already_final");
    expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
    expect((await booking(s.bid))["refundStatus"]).toBe("initiated");
  });
  const cases: Array<[string, Parameters<typeof seed>[0], { rid?: string; amt?: number; cur?: string }]> = [
    ["refund id differs from stored", {}, { rid: "rfnd_other" }],
    ["amount differs", {}, { amt: 100 }],
    ["currency differs", {}, { cur: "USD" }],
    ["no stored refund request or booking refund id", { reqRid: null }, {}],
    ["booking tenant differs", { bookingTenant: "other" }, {}],
    ["payment stored refund id differs", { payRid: "rfnd_x" }, {}],
    ["failed booking refundStatus is never upgraded by processed", { bookingRefundStatus: "failed" }, {}],
  ];
  for (const [name, seedOver, evOver] of cases) {
    it(`${name}: final payment, NO booking/payment write`, async () => {
      const s = await seed({ ...seedOver, payStatus: "refunded" }); const bb = await booking(s.bid); const pb = await payment(s.pid);
      const r = await processProviderEvent(db, evt("refund.processed", "EM" + s.pid, { pay: s.pay, rid: evOver.rid ?? s.rid, amt: evOver.amt ?? 50000, cur: evOver.cur }));
      expect(r.outcome).toBe("already_final");
      expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
    });
  }
  it("unknown payment: recorded, no write", async () => {
    expect((await processProviderEvent(db, evt("refund.processed", "EU" + Date.now(), { pay: "pay_nope", rid: "rfnd_nope", amt: 1 }))).outcome).toBe("unknown_payment");
  });
  it("out of order: processed then refund.created on a final payment does not regress it", async () => {
    const s = await seed({ payStatus: "refunded", bookingRefundStatus: "processed" });
    await processProviderEvent(db, evt("refund.processed", "EO" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }));
    expect((await processProviderEvent(db, evt("refund.created", "EC" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("already_final");
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
    it(`malformed event on a final payment: ${name}: no write`, async () => {
      const s = await seed({ payStatus: "refunded", bookingRefundStatus: "processed" }); const bb = await booking(s.bid); const pb = await payment(s.pid);
      const r = await processProviderEvent(db, raw("EG" + s.pid, s.pay, s.rid, mk(s.pay)));
      expect(["already_final", "unknown_payment"]).toContain(r.outcome);
      expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
    });
  }
  // Legacy admin / dashboard refund with NO outbox owner keeps the generic path (5205613d "unrelated" verdict):
  // a payment still "completed" is projected exactly once from the refund entity's own amount.
  it("no outbox owner (dashboard/legacy admin refund, payment still completed): generic path projects once, replay is final", async () => {
    const s = await seed({ reqRid: null, payStatus: "completed", payRid: "" });
    const e = evt("refund.processed", "EA" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 });
    expect((await processProviderEvent(db, e)).outcome).toBe("refunded");
    expect((await payment(s.pid))["status"]).toBe("refunded");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    expect((await processProviderEvent(db, evt("refund.processed", "EA2" + s.pid, { pay: s.pay, rid: s.rid, amt: 50000 }))).outcome).toBe("already_final");
  });
});

describe("RESERVED refund.created binding (real emulator)", () => {
  async function reserved(amt: number) {
    const { reserveRefund: rr } = await import("../../lib/refund-outbox.js");
    n += 1; const id = `${Date.now()}${n}`; const pid = `rcpay${id}`, pay = `pay_rc${id}`;
    const p = { id: pid, tenantId: T, studioId: null, targetType: "job", jobId: null, bookingId: null, customerId: "c", amount: 100000, currency: "INR",
      status: "completed", method: "razorpay_payment_link", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
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
  // 5205613d: a refund.created bound to our request by receipt (payment id + amount + currency) is "outbox_owned": recorded,
  // never generically projected. A created event with no "processed" status does not move the request or the payment.
  it("partial (30000 < captured 100000) bound by receipt is outbox_owned; redelivery duplicate; payment and request untouched", async () => {
    const s = await reserved(30000); const before = await payment(s.pid);
    const e = created("RC" + s.pid, s.pay, "rfnd_a" + s.pid, 30000, "INR", 100000, s.requestId);
    expect((await processProviderEvent(db, e)).outcome).toBe("outbox_owned");
    expect(await reqStatus(s.requestId)).toBe("reserved");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    expect(await payment(s.pid)).toEqual(before);
  });
  it("currency mismatch, missing amount, amount = payment amount (wrong binding): ownership_mismatch, zero writes, request stays reserved", async () => {
    const s = await reserved(30000);
    for (const [i, e] of [
      created("RX1" + s.pid, s.pay, "rfnd_b", 30000, "USD", 100000, s.requestId),
      created("RX2" + s.pid, s.pay, "rfnd_b", undefined, "INR", 100000, s.requestId),
      created("RX4" + s.pid, s.pay, "rfnd_b", 100000, "INR", 100000, s.requestId),
    ].entries()) {
      expect((await processProviderEvent(db, e)).outcome, `case ${i}`).toBe("ownership_mismatch");
    }
    expect(await reqStatus(s.requestId)).toBe("reserved");
  });
  it("missing refund id on an event bound by receipt: no write, request is not projected", async () => {
    const s = await reserved(30000); const before = await payment(s.pid);
    await processProviderEvent(db, created("RX3" + s.pid, s.pay, "", 30000, "INR", 100000, s.requestId));
    expect(await reqStatus(s.requestId)).not.toBe("projected");
    expect(await payment(s.pid)).toEqual(before);
  });
  // A processed event with NO receipt and NO payment entity cannot be tied to our request: 5205613d treats it as an
  // unowned (dashboard) refund and the generic path projects it. Safety invariant: our still-reserved FULL-amount request
  // must NOT then be submitted on top of that money (total returned would exceed the payment). The fixture carries
  // method "razorpay_payment_link" because the runner's integrity preflight holds a payment with no provider refund rail.
  it("unreceipted dashboard refund projected generically, then a reserved full-amount request: runner never submits it (no over-refund)", async () => {
    const s = await reserved(100000);
    const pe = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_dash" + s.pid, payment_id: s.pay, amount: 30000, currency: "INR", status: "processed" } } } }));
    pe.providerEventId = "RO2" + s.pid;
    const r = await processProviderEvent(db, pe);
    expect(["refunded", "ownership_mismatch", "outbox_owned"]).toContain(r.outcome);
    let submitted = 0;
    const { runRefundOutbox } = await import("../../lib/refund-outbox.js");
    await runRefundOutbox(db, { initiateRefund: async (a: { referenceId?: string; amount?: number }) => { if (a.referenceId === s.requestId) submitted += a.amount ?? 0; return { providerRefundId: "rfnd_second" + s.pid }; } } as never);
    const after = await payment(s.pid);
    expect(Number(after["refundAmount"] ?? 0) + submitted).toBeLessThanOrEqual(100000);
  });
  // Held across retries and provider completion, not one runner pass: three runner passes, a redelivered generic event, and a
  // provider "processed" completion for whatever the runner submitted must never take the total above the payment amount.
  it("same case across repeated runner passes, event redelivery and provider completion: total returned stays <= payment amount", async () => {
    const s = await reserved(100000);
    const mk = () => { const e = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_dash" + s.pid, payment_id: s.pay, amount: 30000, currency: "INR", status: "processed" } } } })); e.providerEventId = "RO3" + s.pid; return e; };
    await processProviderEvent(db, mk());
    const { runRefundOutbox } = await import("../../lib/refund-outbox.js");
    const calls: number[] = [];
    const initiate = async (a: { referenceId?: string; amount?: number }) => { if (a.referenceId === s.requestId) calls.push(a.amount ?? 0); return { providerRefundId: "rfnd_ours" + s.pid, status: "processed" } as never; };
    for (let i = 0; i < 3; i++) { await runRefundOutbox(db, { initiateRefund: initiate } as never); await processProviderEvent(db, mk()); }
    // provider completion of our own submission, if any was made
    if (calls.length) { const e = provider.parseWebhookEvent(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_ours" + s.pid, payment_id: s.pay, amount: calls[0], currency: "INR", status: "processed", receipt: s.requestId } } } })); e.providerEventId = "RO4" + s.pid; await processProviderEvent(db, e); }
    const after = await payment(s.pid);
    const total = Number(after["refundAmount"] ?? 0) + calls.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100000);
    expect(calls.length).toBeLessThanOrEqual(1);
  });
});

describe("refund.processed BEFORE the outbox projection (real emulator, real runner)", () => {
  async function setup() {
    const { reserveRefund, runRefundOutbox } = await import("../../lib/refund-outbox.js");
    n += 1; const id = `${Date.now()}${n}`; const pid = `rbpay${id}`, bid = `rbb${id}`, pay = `pay_rb${id}`, rid = `rfnd_rb${id}`;
    const p = { id: pid, tenantId: T, studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c", amount: 50000, currency: "INR",
      status: "completed", method: "razorpay_payment_link", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
    await db.collection("payments").doc(pid).set(p as object);
    await db.collection("bookings").doc(bid).set({ id: bid, tenantId: T, paymentStatus: "paid" });
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const ev = (eid: string, r = rid, receipt: string | null = requestId, type = "refund.processed") => {
      const e = provider.parseWebhookEvent(JSON.stringify({ event: type, payload: { refund: { entity: { id: r, payment_id: pay, amount: 50000, currency: "INR", status: "processed", receipt } } } }));
      e.providerEventId = eid; return e;
    };
    const submits = { n: 0 };
    return { pid, bid, rid, requestId, ev, submits, run: (boundRid = rid) => runRefundOutbox(db, { initiateRefund: async (a: { referenceId?: string }) => { if (a.referenceId === requestId) submits.n += 1; return { providerRefundId: boundRid }; } } as never) };
  }
  const reqDoc = async (id: string) => (await db.collection("refundRequests").doc(id).get()).data()!;
  it("processed before the runner: adopted and projected once with zero provider calls; redelivery duplicate; later runner submits nothing", async () => {
    const s = await setup(); const e = s.ev("EB" + s.pid);
    expect((await processProviderEvent(db, e)).outcome).toBe("outbox_owned");
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
    expect((await payment(s.pid))["status"]).toBe("refunded");
    expect((await reqDoc(s.requestId))["status"]).toBe("projected");
    expect((await db.collection("paymentEvents").doc(e.providerEventId).get()).data()!["outcome"]).toBe("outbox_owned");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    const at = (await booking(s.bid))["refundProcessedAt"];
    await s.run();
    expect(s.submits.n).toBe(0);
    expect((await booking(s.bid))["refundProcessedAt"]).toBe(at);
    expect((await alerts(s.pid)).filter((a) => a["kind"] === "refund_event_pending")).toHaveLength(0);
  });
  it("conflicts are held with zero writes: receipt naming a request that does not exist, and a refund id that differs from the bound refund", async () => {
    const s = await setup();
    // rr_ receipt with no persisted request: malformed ownership evidence -> ownership_mismatch, nothing written.
    expect((await processProviderEvent(db, s.ev("EBc1" + s.pid, s.rid, "rr_other"))).outcome).toBe("ownership_mismatch");
    expect((await booking(s.bid))["refundStatus"]).toBeUndefined();
    expect((await payment(s.pid))["status"]).toBe("completed");
    await s.run(); // runner submits ours and binds s.rid; this is the first projection (pre-event path)
    const pb = await payment(s.pid); const bb = await booking(s.bid);
    await processProviderEvent(db, s.ev("EBc2" + s.pid, "rfnd_foreign" + s.pid));
    // a different refund id for the same request must never overwrite the bound refund or move money again
    expect((await payment(s.pid))["razorpayRefundId"]).toBe(pb["razorpayRefundId"]);
    expect((await booking(s.bid))["refundStatus"]).toBe(bb["refundStatus"]);
    expect(s.submits.n).toBe(1);
  });
  it("unowned refund for a payment whose stored accounting is already full: amount_mismatch, zero writes (malformed prior state is held)", async () => {
    const s = await seed({ reqRid: null, payStatus: "completed", payRid: "", refundAmt: 50000 });
    const bb = await booking(s.bid); const pb = await payment(s.pid);
    expect((await processProviderEvent(db, evt("refund.processed", "EBf" + s.pid, { pay: s.pay, rid: "rfnd_foreign" + s.pid, amt: 50000 }))).outcome).toBe("amount_mismatch");
    expect(await booking(s.bid)).toEqual(bb); expect(await payment(s.pid)).toEqual(pb);
  });
});

describe("later events after an owned processed event (real emulator, real runner)", () => {
  async function ownedSetup() {
    const { reserveRefund, runRefundOutbox } = await import("../../lib/refund-outbox.js");
    n += 1; const id = `${Date.now()}${n}`; const pid = `rdpay${id}`, bid = `rdb${id}`, pay = `pay_rd${id}`, rid = `rfnd_rd${id}`;
    const p = { id: pid, tenantId: T, studioId: null, targetType: "booking", jobId: null, bookingId: bid, customerId: "c", amount: 50000, currency: "INR",
      status: "completed", method: "razorpay_payment_link", razorpayPaymentId: pay, razorpayRefundId: null, refundAmount: null } as never;
    await db.collection("payments").doc(pid).set(p as object);
    await db.collection("bookings").doc(bid).set({ id: bid, tenantId: T, paymentStatus: "paid" });
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 50000, reason: "x", createdBy: "a1" });
    const mk = (event: string, eid: string, r = rid, pId = pay, receipt: string | null = requestId) => {
      const e = provider.parseWebhookEvent(JSON.stringify({ event, payload: { refund: { entity: { id: r, payment_id: pId, amount: 50000, currency: "INR", status: "processed", receipt } } } }));
      e.providerEventId = eid; return e;
    };
    const pe = mk("refund.processed", "RDP" + pid);
    expect((await processProviderEvent(db, pe)).outcome).toBe("outbox_owned");
    const submits = { n: 0 };
    return { pid, bid, rid, pe, mk, submits, requestId, run: () => runRefundOutbox(db, { initiateRefund: async (a: { referenceId?: string }) => { if (a.referenceId === requestId) submits.n += 1; return { providerRefundId: rid }; } } as never) };
  }
  it("a later refund.created for the same refund after projection is final: nothing changes, no alert", async () => {
    const s = await ownedSetup();
    const at = (await booking(s.bid))["refundProcessedAt"];
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
    expect((await processProviderEvent(db, s.mk("refund.created", "RDC" + s.pid))).outcome).toBe("already_final");
    expect((await processProviderEvent(db, s.mk("refund.created", "RDC2" + s.pid))).outcome).toBe("already_final");
    expect((await booking(s.bid))["refundProcessedAt"]).toBe(at);
    expect(await alerts(s.pid)).toHaveLength(0);
  });
  it("concurrent later events: all final, projection applied exactly once", async () => {
    const s = await ownedSetup();
    const res = await Promise.all([1, 2, 3].map((i) => processProviderEvent(db, s.mk("refund.created", `RDk${i}` + s.pid))));
    expect(res.every((r) => r.outcome === "already_final")).toBe(true);
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
    expect((await payment(s.pid))["status"]).toBe("refunded");
  });
  it("a later event for a DIFFERENT refund id on a final payment changes nothing", async () => {
    const s = await ownedSetup(); const pb = await payment(s.pid); const bb = await booking(s.bid);
    await processProviderEvent(db, s.mk("refund.created", "RDx" + s.pid, "rfnd_other_refund"));
    expect(await payment(s.pid)).toEqual(pb); expect(await booking(s.bid)).toEqual(bb);
  });
  it("scope: a later event on ANOTHER payment (even the same refund id) never touches this projection", async () => {
    const s = await ownedSetup(); const pb = await payment(s.pid); const bb = await booking(s.bid);
    const other = await seed({ payStatus: "refunded", bookingRefundStatus: "processed" });
    await processProviderEvent(db, evt("refund.created", "RDo" + other.pid, { pay: other.pay, rid: s.rid, amt: 50000 }));
    expect(await payment(s.pid)).toEqual(pb); expect(await booking(s.bid)).toEqual(bb);
  });
  it("the runner after an owned processed event never submits a second provider refund", async () => {
    const s = await ownedSetup(); await s.run();
    expect(s.submits.n).toBe(0);
    expect((await booking(s.bid))["refundStatus"]).toBe("processed");
  });
});

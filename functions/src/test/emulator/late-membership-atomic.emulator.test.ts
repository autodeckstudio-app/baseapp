/**
 * TEST. R1 (local): the late-membership full-refund RESERVATION commits in the SAME Firestore transaction as
 * the payment completion and the event doc. Real Firestore emulator; the Razorpay event is a local fixture.
 * No provider call. Fault injection: the reservation write throws inside the transaction callback, before commit.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { COLLECTIONS } from "@autodeck/database";
import { reserveRefund } from "../../lib/refund-outbox.js";

const db = getFirestore();
const provider = new RazorpayProvider("rzp_test_x", "secret", "whsec_test");
const T = "r1-tenant";
let n = 0;
const body = (pid: string, plink: string, eid: string) => JSON.stringify({ entity: "event", event: "payment.link.paid", payload: {
  payment: { entity: { id: "pay_x" + pid, order_id: "o1", amount: 29900, currency: "INR" } },
  payment_link: { entity: { id: plink, reference_id: pid, amount: 29900 } } }, _id: eid });
const ev = (pid: string, plink: string, eid: string) => { const e = provider.parseWebhookEvent(body(pid, plink, eid)); e.providerEventId = eid; return e; };

async function seed(mStatus: string) {
  n += 1;
  const pid = `r1pay${Date.now()}${n}`, mid = `r1m${Date.now()}${n}`, plink = `plink_${pid}`;
  await db.collection("memberships").doc(mid).set({ id: mid, tenantId: T, status: mStatus });
  await db.collection("payments").doc(pid).set({ id: pid, tenantId: T, studioId: null, targetType: "membership", jobId: null, bookingId: null,
    membershipId: mid, customerId: "c1", amount: 29900, currency: "INR", method: "razorpay_payment_link", status: "pending",
    razorpayPaymentLinkId: plink, razorpayPaymentId: null, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null });
  return { pid, mid, plink };
}
const reqs = async (pid: string) => (await db.collection("refundRequests").where("paymentId", "==", pid).get()).docs.filter((d) => d.id.startsWith("rr_")).map((d) => d.data());

/** A db whose transactions throw when the reservation request doc is created: a fault inside the transaction. */
function faulty(): FirebaseFirestore.Firestore {
  return new Proxy(db, { get(t, k) {
    if (k === "runTransaction") return (fn: (tx: FirebaseFirestore.Transaction) => Promise<unknown>, o?: unknown) =>
      t.runTransaction(async (tx) => fn(new Proxy(tx, { get(tt, kk) {
        if (kk === "create") return (ref: FirebaseFirestore.DocumentReference, d: unknown) => {
          if (ref.path.startsWith("refundRequests/rr_")) throw new Error("injected fault");
          return tt.create(ref, d as never);
        };
        const v = (tt as any)[kk]; return typeof v === "function" ? v.bind(tt) : v; // eslint-disable-line
      } })), o as never);
    const v = (t as any)[k]; return typeof v === "function" ? v.bind(t) : v; // eslint-disable-line
  } }) as FirebaseFirestore.Firestore;
}

describe("late membership capture: atomic reservation (emulator)", () => {
  beforeEach(() => undefined);
  it("commits payment completion, event doc, reservation and alert together", async () => {
    const s = await seed("cancelled");
    expect((await processProviderEvent(db, ev(s.pid, s.plink, "E1" + s.pid))).outcome).toBe("completed");
    expect((await db.collection("payments").doc(s.pid).get()).data()!["status"]).toBe("completed");
    const r = await reqs(s.pid);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "reserved", amountPaise: 29900, providerRefundId: null, reason: "late_membership_payment" });
    expect((await db.collection("staffAlerts").doc(`late_membership_payment_${s.pid}`).get()).data()!["kind"]).toBe("late_membership_payment");
    expect((await db.collection("memberships").doc(s.mid).get()).data()!["status"]).toBe("cancelled");
  });
  it("fault inside the transaction rolls EVERYTHING back; the SAME event redelivered then completes and reserves once", async () => {
    const s = await seed("cancelled");
    const id = "E2" + s.pid;
    await expect(processProviderEvent(faulty(), ev(s.pid, s.plink, id))).rejects.toThrow("injected fault");
    expect((await db.collection("payments").doc(s.pid).get()).data()!["status"]).toBe("pending");
    expect((await db.collection(COLLECTIONS.paymentEvents()).doc(id).get()).exists).toBe(false);
    expect(await reqs(s.pid)).toHaveLength(0);
    expect((await db.collection("staffAlerts").doc(`late_membership_payment_${s.pid}`).get()).exists).toBe(false);
    expect((await processProviderEvent(db, ev(s.pid, s.plink, id))).outcome).toBe("completed");
    expect((await reqs(s.pid))).toHaveLength(1);
    expect((await processProviderEvent(db, ev(s.pid, s.plink, id))).outcome).toBe("duplicate");
    expect((await reqs(s.pid))).toHaveLength(1);
  });
  it("existing reservation = SAME payment, FULL amount, same reason: satisfied, no new request, 'already reserved' alert", async () => {
    const s = await seed("expired");
    await db.collection("refundRequests").doc(`active_${s.pid}`).set({ paymentId: s.pid, requestId: "rr_s_1" });
    await db.collection("refundRequests").doc("rr_s_1").set({ id: "rr_s_1", paymentId: s.pid, status: "reserved", amountPaise: 29900, reason: "late_membership_payment" });
    expect((await processProviderEvent(db, ev(s.pid, s.plink, "E3" + s.pid))).outcome).toBe("completed");
    expect(await reqs(s.pid)).toHaveLength(1);
    expect((await db.collection("staffAlerts").doc(`late_membership_payment_${s.pid}`).get()).data()!["kind"]).toBe("late_membership_already_reserved");
  });
  it("conflicting reservations (wrong amount, wrong reason, orphan guard): receipt completes, refund UNSATISFIED, distinct owed-not-reserved alert, no new request", async () => {
    const cases: Array<[string, Record<string, unknown> | null]> = [
      ["wrong amount", { status: "reserved", amountPaise: 100, reason: "late_membership_payment" }],
      ["wrong reason", { status: "reserved", amountPaise: 29900, reason: "no_show" }],
      ["orphan guard only", null],
    ];
    for (const [label, rr] of cases) {
      const s = await seed("cancelled");
      await db.collection("refundRequests").doc(`active_${s.pid}`).set({ paymentId: s.pid, requestId: "rr_c_1" });
      if (rr) await db.collection("refundRequests").doc(`rr_c_${s.pid}`).set({ id: `rr_c_${s.pid}`, paymentId: s.pid, ...rr });
      expect((await processProviderEvent(db, ev(s.pid, s.plink, "E6" + s.pid))).outcome, label).toBe("completed");
      expect((await db.collection("payments").doc(s.pid).get()).data()!["status"], label).toBe("completed");
      expect(await reqs(s.pid), label).toHaveLength(rr ? 1 : 0);
      const al = (await db.collection("staffAlerts").doc(`late_membership_payment_${s.pid}`).get()).data()!;
      expect(al["kind"], label).toBe("late_membership_refund_not_reserved");
      expect(al["reservationOutcome"], label).toBe("conflict");
    }
  });
  it("invalid amount (stored amount 0, event carries no amount: the existing shared amount check is skipped): receipt completes, owed-not-reserved alert outcome invalid, no request", async () => {
    const s = await seed("cancelled");
    await db.collection("payments").doc(s.pid).update({ amount: 0 });
    const raw = JSON.stringify({ entity: "event", event: "payment.link.paid", payload: {
      payment: { entity: { id: "pay_x" + s.pid, order_id: "o1", currency: "INR" } },
      payment_link: { entity: { id: s.plink, reference_id: s.pid } } }, _id: "E7" + s.pid });
    const e = provider.parseWebhookEvent(raw); e.providerEventId = "E7" + s.pid;
    expect((await processProviderEvent(db, e)).outcome).toBe("completed");
    expect((await db.collection("payments").doc(s.pid).get()).data()!["status"]).toBe("completed");
    const al = (await db.collection("staffAlerts").doc(`late_membership_payment_${s.pid}`).get()).data()!;
    expect(al["kind"]).toBe("late_membership_refund_not_reserved");
    expect(al["reservationOutcome"]).toBe("invalid");
    expect(await reqs(s.pid)).toHaveLength(0);
  });
  it("pending membership: activates, reserves nothing; ACTIVE membership second capture untouched", async () => {
    const s = await seed("pending");
    expect((await processProviderEvent(db, ev(s.pid, s.plink, "E4" + s.pid))).outcome).toBe("completed");
    expect((await db.collection("memberships").doc(s.mid).get()).data()!["status"]).toBe("active");
    expect(await reqs(s.pid)).toHaveLength(0);
    const a = await seed("active");
    expect((await processProviderEvent(db, ev(a.pid, a.plink, "E5" + a.pid))).outcome).toBe("completed");
    expect(await reqs(a.pid)).toHaveLength(0);
  });
  it("the shared wrapper reserveRefund still works for its other callers and still refuses a duplicate", async () => {
    const s = await seed("cancelled");
    await db.collection("payments").doc(s.pid).update({ status: "completed" });
    const p = (await db.collection("payments").doc(s.pid).get()).data() as never;
    await reserveRefund(db, { payment: p, amountPaise: 100, reason: "test", createdBy: "u" });
    await expect(reserveRefund(db, { payment: p, amountPaise: 100, reason: "test", createdBy: "u" })).rejects.toThrow("already has an active");
    await expect(reserveRefund(db, { payment: p, amountPaise: 0, reason: "t", createdBy: "u" })).rejects.toThrow("positive integer");
    await expect(reserveRefund(db, { payment: p, amountPaise: 99999999, reason: "t", createdBy: "u" })).rejects.toThrow("exceeds");
  });
});

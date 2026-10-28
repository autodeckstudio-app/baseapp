/**
 * TEST. Mixed-vintage rollout: an OLDER instance completed a capture for a cancelled/expired membership with no reservation and
 * no alert. A redelivered/duplicate provider event on the NEWER code must repair ONLY a payment proven late, once, and never touch
 * a normal paid membership that was cancelled or expired AFTER it paid. Real Firestore emulator; local event fixtures; no provider call.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { RazorpayProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";

const db = getFirestore();
const provider = new RazorpayProvider("rzp_test_x", "secret", "whsec_test");
const T = "r1mv-tenant";
let n = 0;
const ev = (pid: string, plink: string, eid: string) => { const e = provider.parseWebhookEvent(JSON.stringify({ entity: "event", event: "payment.link.paid", payload: {
  payment: { entity: { id: "pay_x" + pid, order_id: "o1", amount: 29900, currency: "INR" } },
  payment_link: { entity: { id: plink, reference_id: pid, amount: 29900 } } }, _id: eid })); e.providerEventId = eid; return e; };
async function seed(m: Record<string, unknown>, completedAt: string | null, payStatus = "completed") {
  n += 1; const pid = `mvpay${Date.now()}${n}`, mid = `mvm${Date.now()}${n}`, plink = `plink_${pid}`;
  await db.collection("memberships").doc(mid).set({ id: mid, tenantId: T, ...m });
  await db.collection("payments").doc(pid).set({ id: pid, tenantId: T, studioId: null, targetType: "membership", jobId: null, bookingId: null,
    membershipId: mid, customerId: "c1", amount: 29900, currency: "INR", method: "razorpay_payment_link", status: payStatus,
    razorpayPaymentLinkId: plink, razorpayPaymentId: "pay_x" + pid, razorpayOrderId: null, razorpayRefundId: null, refundAmount: null, completedAt });
  return { pid, mid, plink };
}
const reqs = async (pid: string) => (await db.collection("refundRequests").where("paymentId", "==", pid).get()).docs.filter((d) => d.id.startsWith("rr_")).map((d) => d.data());
const alertOf = async (pid: string) => (await db.collection("staffAlerts").doc(`late_membership_payment_${pid}`).get());

describe("late membership payment already completed by an older instance (emulator)", () => {
  it("cancelled before the payment completed: duplicate event reserves the full amount once and alerts; a second redelivery adds nothing", async () => {
    const s = await seed({ status: "cancelled", cancelledAt: "2026-10-28T10:00:00.000Z" }, "2026-10-28T11:00:00.000Z");
    expect((await processProviderEvent(db, ev(s.pid, s.plink, "A1" + s.pid))).outcome).toBe("already_final");
    const r = await reqs(s.pid);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ status: "reserved", amountPaise: 29900, reason: "late_membership_payment", providerRefundId: null });
    expect((await alertOf(s.pid)).data()).toMatchObject({ kind: "late_membership_payment", repairedAfterCompletion: true });
    await processProviderEvent(db, ev(s.pid, s.plink, "A2" + s.pid));
    expect(await reqs(s.pid)).toHaveLength(1);
    expect((await db.collection("payments").doc(s.pid).get()).data()!["status"]).toBe("completed");
  });
  it("expired membership, payment completed after its end date: repaired", async () => {
    const s = await seed({ status: "expired", endDate: "2026-10-01" }, "2026-10-28T11:00:00.000Z");
    await processProviderEvent(db, ev(s.pid, s.plink, "B1" + s.pid));
    expect(await reqs(s.pid)).toHaveLength(1);
  });
  it("normal paid membership cancelled or expired AFTER paying: never touched", async () => {
    const a = await seed({ status: "cancelled", cancelledAt: "2026-10-28T12:00:00.000Z" }, "2026-10-20T11:00:00.000Z");
    const b = await seed({ status: "expired", endDate: "2026-10-27" }, "2026-09-28T11:00:00.000Z");
    const c = await seed({ status: "active", endDate: "2026-12-01" }, "2026-10-20T11:00:00.000Z");
    for (const s of [a, b, c]) {
      await processProviderEvent(db, ev(s.pid, s.plink, "C" + s.pid));
      expect(await reqs(s.pid)).toHaveLength(0);
      expect((await alertOf(s.pid)).exists).toBe(false);
    }
  });
  it("missing or unparseable evidence, or a refunded payment: no repair (fail closed to no write)", async () => {
    const noCancelledAt = await seed({ status: "cancelled" }, "2026-10-28T11:00:00.000Z");
    const noCompletedAt = await seed({ status: "cancelled", cancelledAt: "2026-10-28T10:00:00.000Z" }, null);
    const badDate = await seed({ status: "cancelled", cancelledAt: "not-a-date" }, "2026-10-28T11:00:00.000Z");
    const refunded = await seed({ status: "cancelled", cancelledAt: "2026-10-28T10:00:00.000Z" }, "2026-10-28T11:00:00.000Z", "refunded");
    const noMembership = await seed({ status: "cancelled", cancelledAt: "2026-10-28T10:00:00.000Z" }, "2026-10-28T11:00:00.000Z");
    await db.collection("memberships").doc(noMembership.mid).delete();
    for (const s of [noCancelledAt, noCompletedAt, badDate, refunded, noMembership]) {
      await processProviderEvent(db, ev(s.pid, s.plink, "D" + s.pid));
      expect(await reqs(s.pid)).toHaveLength(0);
      expect((await alertOf(s.pid)).exists).toBe(false);
    }
  });
  it("an existing reservation is respected: alert says already reserved, no second request", async () => {
    const s = await seed({ status: "cancelled", cancelledAt: "2026-10-28T10:00:00.000Z" }, "2026-10-28T11:00:00.000Z");
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    const p = (await db.collection("payments").doc(s.pid).get()).data()!;
    await reserveRefund(db, { payment: p as never, amountPaise: 29900, reason: "late_membership_payment", createdBy: "system" });
    await processProviderEvent(db, ev(s.pid, s.plink, "E1" + s.pid));
    expect(await reqs(s.pid)).toHaveLength(1);
    expect((await alertOf(s.pid)).data()!["kind"]).toBe("late_membership_already_reserved");
  });
});

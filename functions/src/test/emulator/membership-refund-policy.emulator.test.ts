/**
 * Owner policy 30 Oct 2026 (Meet, iMessage): membership refunds are always FULL,
 * and a full refund stops that membership's benefits. Emulator proof over the
 * unrelated (dashboard) refund path and its guardrails:
 *  - full refund cancels the payment's OWN membership (active or pending)
 *  - partial refund (not offered) leaves the membership and alerts staff
 *  - upgrade refund restores the still-valid, never-refunded predecessor to its
 *    ORIGINAL expiry (owner approval 30 Oct 2026, evidence retained outside the
 *    repo); ineligible predecessors stay ended; any other membership untouched
 *  - booking/job refunds carry no membership side effects
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS, SUBCOLLECTIONS } from "@autodeck/database";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import type { ProviderWebhookEvent } from "../../lib/payment-provider.js";

const db = getFirestore();
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

function membershipPayment(mid: string, o: Record<string, unknown> = {}): Payment {
  return {
    id: uid("pay"), tenantId: "t1", studioId: null, targetType: "membership", jobId: null, bookingId: null,
    membershipId: mid, giftId: null, customerId: "c1", amount: 29900, currency: "INR",
    method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
    razorpayPaymentId: uid("rzp_pay"), razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
    manualReference: null, recordedBy: null, invoiceId: null, providerEventId: null,
    completedAt: new Date().toISOString(), failedAt: null, cancelledAt: null, refundedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...o,
  } as Payment;
}

function refundEvent(p: Payment, amount: number, o: Partial<ProviderWebhookEvent> = {}): ProviderWebhookEvent {
  return {
    eventType: "refund.processed", providerEventId: uid("evt"), providerPaymentId: p.razorpayPaymentId!,
    providerPaymentLinkId: "pl1", providerRefundId: uid("rfnd"), referenceId: p.id,
    amount, currency: "INR",
    providerRefundAmount: amount, providerRefundCurrency: "INR", providerRefundReceipt: null,
    providerRefundPaymentId: p.razorpayPaymentId ?? null, providerRefundStatus: "processed",
    ...o,
  } as ProviderWebhookEvent;
}

async function seedMembership(id: string, status: string, extra: Record<string, unknown> = {}) {
  await db.collection(COLLECTIONS.memberships()).doc(id).set({ id, tenantId: "t1", customerId: "c1", status, ...extra });
}
const membership = async (id: string) => (await db.collection(COLLECTIONS.memberships()).doc(id).get()).data() as Record<string, unknown>;
const audits = async (entityId: string) =>
  (await db.collection(COLLECTIONS.auditLog()).where("entityId", "==", entityId).get()).docs.map((d) => d.data());

beforeEach(async () => {
  await db.collection(COLLECTIONS.customers()).doc("c1").set({id:"c1",authUid:"c1",tenantId:"t1",deletedAt:null});
  for (const col of [COLLECTIONS.payments(), COLLECTIONS.memberships(), COLLECTIONS.paymentRefunds(), COLLECTIONS.refundRequests(), COLLECTIONS.paymentEvents(), COLLECTIONS.staffAlerts(), COLLECTIONS.auditLog(), COLLECTIONS.jobs(), COLLECTIONS.bookings(), "membershipClaims"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
});

describe("membership refund policy (full-only, deactivates)", () => {
  it("full refund of an ACTIVE membership's payment cancels that membership with audit", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const r = await processProviderEvent(db, refundEvent(p, 29900));
    expect(r.outcome).toBe("refunded");
    const m = await membership(mid);
    expect(m.status).toBe("cancelled");
    expect(m.cancellationReason).toBe(`refunded:${p.id}`);
    expect(m.cancelledBy).toBe("system");
    const a = await audits(mid);
    expect(a.some((x) => x["action"] === "membership.cancelled" && (x["after"] as Record<string, unknown>)["reason"] === "payment_refunded")).toBe(true);
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!.status).toBe("refunded");
  });

  it("full refund of a PENDING membership's payment cancels it - it must never activate later", async () => {
    const mid = uid("m");
    await seedMembership(mid, "pending");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(mid)).status).toBe("cancelled");
  });

  it("partial refund (not offered for memberships) leaves the membership active and alerts staff", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 10000))).outcome).toBe("refunded");
    expect((await membership(mid)).status).toBe("active");
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status as string).toBe("partially_refunded");
    const alert = (await db.collection(COLLECTIONS.staffAlerts()).doc(`membership_partial_refund_${p.id}`).get()).data();
    expect(alert?.["kind"]).toBe("membership_partial_refund");
  });

  it("upgrade refund whose predecessor was ITSELF refunded: predecessor stays ended, no restore", async () => {
    const oldMid = uid("m"), newMid = uid("m");
    const futureEnd = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    await seedMembership(oldMid, "cancelled", { cancellationReason: `upgraded_to:${newMid}`, cancelledAt: new Date().toISOString(), endDate: futureEnd });
    await seedMembership(newMid, "active", { upgradeFromMembershipId: oldMid });
    const oldP = membershipPayment(oldMid, { status: "refunded", refundAmount: 29900 });
    await db.collection(COLLECTIONS.payments()).doc(oldP.id).set(oldP);
    const p = membershipPayment(newMid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(newMid)).status).toBe("cancelled");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("cancelled");
    expect(oldM.cancellationReason).toBe(`upgraded_to:${newMid}`); // refunded plan is never restored
    expect((await audits(oldMid)).length).toBe(0);
  });

  it("another active membership of the same customer (different payment) is untouched", async () => {
    const otherMid = uid("m"), thisMid = uid("m");
    await seedMembership(otherMid, "active");
    await seedMembership(thisMid, "active");
    const p = membershipPayment(thisMid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(thisMid)).status).toBe("cancelled");
    expect((await membership(otherMid)).status).toBe("active");
    expect((await audits(otherMid)).length).toBe(0);
  });

  it("full refund of a JOB payment carries no membership side effects (booking refunds unchanged)", async () => {
    const p = membershipPayment("ignored", { targetType: "job", membershipId: null, jobId: uid("job"), bookingId: uid("b"), amount: 100000 });
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).set({ id: p.jobId, tenantId: "t1", bookingId: p.bookingId, paymentStatus: "paid" });
    await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).set({ id: p.bookingId, tenantId: "t1", paymentStatus: "paid" });
    expect((await processProviderEvent(db, refundEvent(p, 100000))).outcome).toBe("refunded");
    expect((await db.collection(COLLECTIONS.memberships()).get()).size).toBe(0);
    expect((await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).get()).data()!["paymentStatus"]).toBe("refunded");
    expect((await db.collection(COLLECTIONS.staffAlerts()).get()).size).toBe(0);
  });

  it("already-ended membership + full refund: payment projects, no membership rewrite", async () => {
    const mid = uid("m");
    await seedMembership(mid, "expired", { endDate: "2026-10-01" });
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    const m = await membership(mid);
    expect(m.status).toBe("expired"); // untouched
    expect(m.cancellationReason ?? null).toBeNull();
  });
});

describe("membership refund policy: initiation-side full-only enforcement", () => {
  it("a PARTIAL reservation against a membership payment is refused at initiation", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    await expect(reserveRefund(db, { payment: p, amountPaise: 10000, reason: "partial try", createdBy: "admin" }))
      .rejects.toThrow("membership refunds are full only");
    // zero state created
    expect((await db.collection(COLLECTIONS.refundRequests()).get()).size).toBe(0);
  });

  it("a FULL reservation against a membership payment is accepted", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 29900, reason: "full refund", createdBy: "admin" });
    expect(requestId).toBeTruthy();
  });

  it("booking payments keep partial reservations (unchanged)", async () => {
    const p = membershipPayment("ignored", { targetType: "job", membershipId: null, jobId: uid("job"), bookingId: uid("b"), amount: 100000 });
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).set({ id: p.jobId, tenantId: "t1", bookingId: p.bookingId, paymentStatus: "paid" });
    await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).set({ id: p.bookingId, tenantId: "t1", paymentStatus: "paid" });
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 40000, reason: "late fee kept", createdBy: "admin" });
    expect(requestId).toBeTruthy();
  });

  it("an over-refund (> full amount) on a membership payment is still refused", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    await expect(reserveRefund(db, { payment: p, amountPaise: 30000, reason: "too much", createdBy: "admin" }))
      .rejects.toThrow("exceeds the refundable");
  });
});

describe("membership refund policy: legacy initiateRefund projection", () => {
  const adminUser = { uid: "admin1", displayName: "Admin", email: null, claims: { role: "admin", tenantId: "t1", studioId: null } } as never;

  it("legacy full refund of a membership payment cancels the membership with audit", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { projectLegacyRefund } = await import("../../lib/refund-claims.js");
    const now = new Date().toISOString();
    await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_legacy_1", reason: "admin refund", user: adminUser, now });
    const m = await membership(mid);
    expect(m.status).toBe("cancelled");
    expect(m.cancellationReason).toBe(`refunded:${p.id}`);
    const pay = (await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data() as Payment;
    expect(pay.status).toBe("refunded");
    expect(pay.refundAmount).toBe(29900);
    const a = await audits(mid);
    expect(a.some((x) => x["action"] === "membership.cancelled" && (x["after"] as Record<string, unknown>)["reason"] === "payment_refunded")).toBe(true);
  });

  it("legacy full refund of a pending membership's payment cancels it - never activates later", async () => {
    const mid = uid("m");
    await seedMembership(mid, "pending");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { projectLegacyRefund } = await import("../../lib/refund-claims.js");
    await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_legacy_2", reason: "admin refund", user: adminUser, now: new Date().toISOString() });
    expect((await membership(mid)).status).toBe("cancelled");
  });

  it("legacy full refund of a JOB payment carries no membership writes (unchanged)", async () => {
    const p = membershipPayment("ignored", { targetType: "job", membershipId: null, jobId: uid("job"), bookingId: uid("b"), amount: 100000 });
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    await db.collection(COLLECTIONS.jobs()).doc(p.jobId!).set({ id: p.jobId, tenantId: "t1", bookingId: p.bookingId, paymentStatus: "paid" });
    await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).set({ id: p.bookingId, tenantId: "t1", paymentStatus: "paid" });
    const { projectLegacyRefund } = await import("../../lib/refund-claims.js");
    await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_legacy_3", reason: "admin refund", user: adminUser, now: new Date().toISOString() });
    expect((await db.collection(COLLECTIONS.memberships()).get()).size).toBe(0);
    expect((await db.collection(COLLECTIONS.bookings()).doc(p.bookingId!).get()).data()!["paymentStatus"]).toBe("refunded");
    expect((await db.collection(COLLECTIONS.staffAlerts()).get()).size).toBe(0);
  });

  it("legacy refund of an already-ended membership leaves it untouched", async () => {
    const mid = uid("m");
    await seedMembership(mid, "expired", { endDate: "2026-10-01" });
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { projectLegacyRefund } = await import("../../lib/refund-claims.js");
    await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_legacy_4", reason: "admin refund", user: adminUser, now: new Date().toISOString() });
    const m = await membership(mid);
    expect(m.status).toBe("expired");
    expect(m.cancellationReason ?? null).toBeNull();
  });
});

describe("membership refund policy: idempotency and concurrency proof", () => {
  it("same refund event redelivered: duplicate, exactly ONE membership cancellation audit", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const e = refundEvent(p, 29900);
    expect((await processProviderEvent(db, e)).outcome).toBe("refunded");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    expect((await processProviderEvent(db, e)).outcome).toBe("duplicate");
    const a = (await audits(mid)).filter((x) => x["action"] === "membership.cancelled");
    expect(a).toHaveLength(1);
    expect((await membership(mid)).status).toBe("cancelled");
  });

  it("same provider refund under a NEW event id: ledger convergence says duplicate, ONE audit", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const e1 = refundEvent(p, 29900);
    expect((await processProviderEvent(db, e1)).outcome).toBe("refunded");
    const e2 = refundEvent(p, 29900, { providerRefundId: e1.providerRefundId }); // same money, new event id
    // already_final: the payment is terminal, so the event is acknowledged with
    // zero financial writes (same guarantee as ledger-level "duplicate").
    expect((await processProviderEvent(db, e2)).outcome).toBe("already_final");
    expect((await audits(mid)).filter((x) => x["action"] === "membership.cancelled")).toHaveLength(1);
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!["refundAmount"]).toBe(29900); // not double-counted
  });

  it("partial refund evidence redelivered: exactly ONE deterministic alert, membership untouched", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const e1 = refundEvent(p, 10000);
    expect((await processProviderEvent(db, e1)).outcome).toBe("refunded");
    const e2 = refundEvent(p, 10000, { providerRefundId: e1.providerRefundId });
    expect((await processProviderEvent(db, e2)).outcome).toBe("duplicate");
    expect((await db.collection(COLLECTIONS.staffAlerts()).get()).size).toBe(1);
    expect((await membership(mid)).status).toBe("active");
  });

  it("legacy projection called twice with the same provider refund: converged, ONE audit", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { projectLegacyRefund } = await import("../../lib/refund-claims.js");
    const adminUser = { uid: "admin1", displayName: "Admin", email: null, claims: { role: "admin", tenantId: "t1", studioId: null } } as never;
    const now = new Date().toISOString();
    await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_dup_1", reason: "admin refund", user: adminUser, now });
    const second = await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_dup_1", reason: "admin refund", user: adminUser, now });
    expect(second.converged).toBe(true);
    expect((await audits(mid)).filter((x) => x["action"] === "membership.cancelled")).toHaveLength(1);
    expect((await db.collection(COLLECTIONS.payments()).doc(p.id).get()).data()!["refundAmount"]).toBe(29900);
  });

  it("two concurrent full reservations on the same membership payment commit exactly ONE request", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    const { reserveRefund } = await import("../../lib/refund-outbox.js");
    const results = await Promise.allSettled([
      reserveRefund(db, { payment: p, amountPaise: 29900, reason: "full refund", createdBy: "admin" }),
      reserveRefund(db, { payment: p, amountPaise: 29900, reason: "full refund", createdBy: "admin" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1); // same-amount same-reason retry is satisfied idempotently or refused; never two requests
    const reqs = (await db.collection(COLLECTIONS.refundRequests()).where("paymentId", "==", p.id).get())
      .docs.filter((d) => d.id.startsWith("rr_")); // exclude the active_<paymentId> guard doc in the same collection
    expect(reqs).toHaveLength(1);
  });
});

describe("membership refund policy: upgrade restoration (approved 30 Oct 2026)", () => {
  const futureEnd = () => new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const pastEnd = () => new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const alertFor = async (paymentId: string) =>
    (await db.collection(COLLECTIONS.staffAlerts()).doc(`membership_restore_uncertain_${paymentId}`).get()).data() as Record<string, unknown> | undefined;
  const claim = async () =>
    (await db.collection("membershipClaims").doc("t1_c1").get()).data() as Record<string, unknown> | undefined;
  async function seedUpgradePair(oldEnd: string, extra: Record<string, unknown> = {}) {
    const oldMid = uid("m"), newMid = uid("m");
    await seedMembership(oldMid, "cancelled", {
      cancellationReason: `upgraded_to:${newMid}`, cancelledAt: new Date().toISOString(), cancelledBy: "system",
      startDate: "2026-10-01", endDate: oldEnd, washesTotal: 8, washesUsed: 2, pickupsTotal: 2, pickupsUsed: 0,
    });
    await seedMembership(newMid, "active", { upgradeFromMembershipId: oldMid, startDate: "2026-10-29", endDate: "2026-11-28", washesUsed: 3, pickupsUsed: 1, ...extra });
    const oldP = membershipPayment(oldMid);
    await db.collection(COLLECTIONS.payments()).doc(oldP.id).set(oldP);
    const p = membershipPayment(newMid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    return { oldMid, newMid, oldP, p };
  }

  it("full refund of an upgrade payment restores the still-valid, unrefunded predecessor to its ORIGINAL expiry", async () => {
    const end = futureEnd();
    const { oldMid, newMid, p } = await seedUpgradePair(end);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(newMid)).status).toBe("cancelled");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("active");
    expect(oldM.endDate).toBe(end); // original expiry, never extended
    expect(oldM.cancelledAt).toBeNull();
    expect(oldM.cancellationReason).toBeNull();
    expect(oldM.restoredBy).toBe("system");
    // owner ruling 30 Oct: washes consumed under the refunded upgrade count (2 + 3 = 5);
    // pickups are NOT carried (no ruling)
    expect(oldM.washesUsed).toBe(5);
    expect(oldM.pickupsUsed).toBe(0);
    // the purchase claim doc moved to the restored plan (concurrent purchase sees it)
    expect((await claim())?.["membershipId"]).toBe(oldMid);
    const restores = (await audits(oldMid)).filter((x) => x["action"] === "membership.restored");
    expect(restores.length).toBe(1);
    expect((restores[0]!["after"] as Record<string, unknown>)["reason"]).toBe("upgrade_refunded");
    expect(await alertFor(p.id)).toBeUndefined(); // clean restore raises no alert
  });

  it("predecessor whose ORIGINAL term already ended stays cancelled - silent, no alert", async () => {
    const { oldMid, newMid, p } = await seedUpgradePair(pastEnd());
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(newMid)).status).toBe("cancelled");
    expect((await membership(oldMid)).status).toBe("cancelled");
    expect((await audits(oldMid)).filter((x) => x["action"] === "membership.restored").length).toBe(0);
    expect(await alertFor(p.id)).toBeUndefined();
  });

  it("predecessor ended by the customer (not the upgrade) stays cancelled - silent, no alert", async () => {
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(oldMid).update({ cancellationReason: "customer_requested" });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("cancelled");
    expect(oldM.cancellationReason).toBe("customer_requested");
    expect(await alertFor(p.id)).toBeUndefined();
  });

  it("another ACTIVE plan for the same customer blocks the restore and alerts staff", async () => {
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    const otherMid = uid("m");
    await seedMembership(otherMid, "active", { endDate: futureEnd() });
    const otherP = membershipPayment(otherMid);
    await db.collection(COLLECTIONS.payments()).doc(otherP.id).set(otherP);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(newMid)).status).toBe("cancelled"); // the refund itself still projects
    expect((await membership(oldMid)).status).toBe("cancelled"); // but nothing is restored
    expect((await membership(otherMid)).status).toBe("active"); // and the other plan is untouched
    const alert = await alertFor(p.id);
    expect(alert?.["reason"]).toBe("alert_other_plan_in_flight");
    expect(alert?.["predecessorMembershipId"]).toBe(oldMid);
  });

  it("purchase claim doc held by another PENDING membership blocks the restore (phantom guard)", async () => {
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    const heldMid = uid("m");
    await seedMembership(heldMid, "pending");
    await db.collection("membershipClaims").doc("t1_c1").set({ tenantId: "t1", customerId: "c1", membershipId: heldMid, updatedAt: new Date().toISOString() });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(oldMid)).status).toBe("cancelled");
    expect((await alertFor(p.id))?.["reason"]).toBe("alert_other_plan_in_flight");
  });

  it("predecessor with NO payment record at all: skip + alert (never restore on uncertain evidence)", async () => {
    const { oldMid, oldP, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.payments()).doc(oldP.id).delete();
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(oldMid)).status).toBe("cancelled");
    expect((await alertFor(p.id))?.["reason"]).toBe("alert_payment_missing");
  });

  it("predecessor whose payment never COMPLETED: skip + alert", async () => {
    const { oldMid, oldP, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.payments()).doc(oldP.id).update({ status: "pending", completedAt: null });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(oldMid)).status).toBe("cancelled");
    expect((await alertFor(p.id))?.["reason"]).toBe("alert_payment_unpaid");
  });

  it("predecessor payment with a PARTIAL refund signal: skip + alert", async () => {
    const { oldMid, oldP, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.payments()).doc(oldP.id).update({ status: "partially_refunded", refundAmount: 100 });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(oldMid)).status).toBe("cancelled");
    expect((await alertFor(p.id))?.["reason"]).toBe("alert_payment_partial");
  });

  it("ownership drift (predecessor in another tenant): skip + alert", async () => {
    const { oldMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(oldMid).update({ tenantId: "t2" });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(oldMid)).status).toBe("cancelled");
    expect((await alertFor(p.id))?.["reason"]).toBe("alert_ownership_drift");
  });

  it("chain A->B->C: refunding C's payment restores B only; A is never read or written", async () => {
    const end = futureEnd();
    const { oldMid: bMid, newMid: cMid, p } = await seedUpgradePair(end);
    const aMid = uid("m");
    await seedMembership(aMid, "cancelled", { cancellationReason: `upgraded_to:${bMid}`, cancelledAt: new Date().toISOString(), endDate: end });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(cMid)).status).toBe("cancelled");
    expect((await membership(bMid)).status).toBe("active"); // direct predecessor restored
    const a = await membership(aMid);
    expect(a.status).toBe("cancelled");
    expect(a.cancellationReason).toBe(`upgraded_to:${bMid}`);
    expect((await audits(aMid)).length).toBe(0);
  });

  it("redelivery of the same upgrade refund: duplicate outcome, predecessor restored exactly ONCE, no alert", async () => {
    const { oldMid, p } = await seedUpgradePair(futureEnd());
    const ev = refundEvent(p, 29900);
    expect((await processProviderEvent(db, ev)).outcome).toBe("refunded");
    expect((await processProviderEvent(db, ev)).outcome).toBe("duplicate");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("active");
    expect(oldM.washesUsed).toBe(5); // carried exactly once, never doubled
    expect((await audits(oldMid)).filter((x) => x["action"] === "membership.restored").length).toBe(1);
    expect(await alertFor(p.id)).toBeUndefined();
  });

  it("full refund of a NON-upgrade membership restores nothing, alerts nothing", async () => {
    const mid = uid("m");
    await seedMembership(mid, "active");
    const p = membershipPayment(mid);
    await db.collection(COLLECTIONS.payments()).doc(p.id).set(p);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(mid)).status).toBe("cancelled");
    expect((await db.collection(COLLECTIONS.auditLog()).where("action", "==", "membership.restored").get()).size).toBe(0);
    expect(await alertFor(p.id)).toBeUndefined();
  });

  it("OPEN wash-covered booking under the refunded upgrade moves to the restored plan, usage records move with it", async () => {
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    const bid = uid("bk"), usageId = uid("use");
    await db.collection(COLLECTIONS.bookings()).doc(bid).set({
      id: bid, tenantId: "t1", customerId: "c1", studioId: null, membershipId: newMid,
      membershipWashUsed: true, status: "CONFIRMED", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await db.collection(SUBCOLLECTIONS.membershipUsage(newMid)).doc(usageId).set({
      id: usageId, tenantId: "t1", membershipId: newMid, customerId: "c1",
      usageType: "wash", jobId: "job1", bookingId: bid, valueRedeemed: 50000, usedAt: new Date().toISOString(),
    });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    const b = (await db.collection(COLLECTIONS.bookings()).doc(bid).get()).data() as Record<string, unknown>;
    expect(b["membershipId"]).toBe(oldMid); // booking now draws on the restored plan
    const moved = await db.collection(SUBCOLLECTIONS.membershipUsage(oldMid)).doc(usageId).get();
    expect(moved.exists).toBe(true);
    expect((moved.data() as Record<string, unknown>)["membershipId"]).toBe(oldMid);
    expect((await db.collection(SUBCOLLECTIONS.membershipUsage(newMid)).doc(usageId).get()).exists).toBe(false);
    expect((await membership(oldMid)).washesUsed).toBe(5);
  });

  it("COMPLETED booking under the refunded upgrade stays put (history); its wash is already in the carried counter", async () => {
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    const bid = uid("bk");
    await db.collection(COLLECTIONS.bookings()).doc(bid).set({
      id: bid, tenantId: "t1", customerId: "c1", studioId: null, membershipId: newMid,
      membershipWashUsed: true, status: "COMPLETED", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    const b = (await db.collection(COLLECTIONS.bookings()).doc(bid).get()).data() as Record<string, unknown>;
    expect(b["membershipId"]).toBe(newMid); // untouched
    expect((await membership(oldMid)).washesUsed).toBe(5); // still counted via the carried counter
  });

  it("carried washes keep TRUE NET use even over the plan total (uncapped ledger - no credit can be minted from overflow)", async () => {
    const { oldMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(oldMid).update({ washesTotal: 5, washesUsed: 4 });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("active");
    expect(oldM.washesUsed).toBe(7); // 4 + 3, NOT capped to 5: entitlement is gated by used < total
  });

  async function seedCoveredBooking(membershipId: string, status = "CONFIRMED") {
    const bid = uid("bk"), jobId = uid("job"), serviceId = uid("svc");
    const now = new Date().toISOString();
    await db.collection("services").doc(serviceId).set({ id: serviceId, tenantId: "t1", category: "wash", membershipWashEligible: true });
    await db.collection(COLLECTIONS.bookings()).doc(bid).set({
      id: bid, tenantId: "t1", studioId: null, customerId: "c1", serviceId, status,
      scheduledAt: new Date(Date.now() + 72 * 3600000).toISOString(), totalAmount: 0, cancelCategories: ["wash"],
      membershipId, membershipWashUsed: true, createdAt: now, updatedAt: now,
    });
    await db.collection(COLLECTIONS.jobs()).doc(jobId).set({
      id: jobId, tenantId: "t1", studioId: null, bookingId: bid, customerId: "c1", status: "PENDING_VEHICLE", statusHistory: [], createdAt: now, updatedAt: now,
    });
    return bid;
  }
  const customerAuthC1 = { uid: "c1", token: { role: "customer", tenantId: "t1", studioId: null }, rawToken: "test" };

  it("REAL cancelBooking after restore: cancellation never mints credit until true net use drops below the plan total", async () => {
    const { cancelBooking } = await import("../../functions/booking/cancelBooking.js");
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(oldMid).update({ washesTotal: 5, washesUsed: 4 });
    const bids = [await seedCoveredBooking(newMid), await seedCoveredBooking(newMid), await seedCoveredBooking(newMid)];
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(oldMid)).washesUsed).toBe(7); // 4 + 3 carried
    for (const bid of bids) {
      expect(((await db.collection(COLLECTIONS.bookings()).doc(bid).get()).data() as Record<string, unknown>)["membershipId"]).toBe(oldMid);
    }
    const washSeq: number[] = [];
    for (const bid of bids) {
      await cancelBooking.run({ data: { bookingId: bid, reason: "changed plans" }, auth: customerAuthC1 } as never);
      washSeq.push((await membership(oldMid)).washesUsed as number);
    }
    expect(washSeq).toEqual([6, 5, 4]); // only the THIRD cancel drops below the plan's 5 - no credit minted from overflow
    const restoredAudits = (await audits(oldMid)).filter((x) => x["action"] === "membership.wash_restored");
    expect(restoredAudits.length).toBe(3);
  });

  it("REAL cancelBooking of a transferred booking with a SUCCESSOR-held pickup: predecessor pickupsUsed is never touched", async () => {
    const { cancelBooking } = await import("../../functions/booking/cancelBooking.js");
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(newMid).update({ pickupsUsed: 1 });
    const bid = await seedCoveredBooking(newMid);
    await db.collection(COLLECTIONS.pickupRequests()).doc(bid).set({
      id: bid, tenantId: "t1", customerId: "c1", bookingId: bid, status: "CONFIRMED", memberMembershipId: newMid,
      kind: "pickup", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect(((await db.collection(COLLECTIONS.bookings()).doc(bid).get()).data() as Record<string, unknown>)["membershipId"]).toBe(oldMid);
    await cancelBooking.run({ data: { bookingId: bid, reason: "changed plans" }, auth: customerAuthC1 } as never);
    const oldM = await membership(oldMid);
    expect(oldM.pickupsUsed).toBe(0); // untouched: no pickup carry, no predecessor debit
    const pickup = (await db.collection(COLLECTIONS.pickupRequests()).doc(bid).get()).data() as Record<string, unknown>;
    expect(pickup["status"]).toBe("DECLINED");
    expect(oldM.washesUsed).toBe(4); // 2 + 3 - 1 cancelled wash, decremented on the LIVE plan
  });

  const adminAuth = { uid: "admin1", token: { role: "admin", tenantId: "t1", studioId: null }, rawToken: "test" };
  async function seedHeldPickup(membershipId: string, bookingId: string) {
    await db.collection(COLLECTIONS.pickupRequests()).doc(bookingId).set({
      id: bookingId, tenantId: "t1", studioId: "st1", customerId: "c1", bookingId,
      kind: "both", status: "CONFIRMED", staffNote: "", agreedPickupAt: null, agreedDropAt: null,
      feePaise: 20000, feeBilled: false, memberMembershipId: membershipId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    return bookingId;
  }
  const pickupDoc = async (id: string) => (await db.collection(COLLECTIONS.pickupRequests()).doc(id).get()).data() as Record<string, unknown>;

  it("REAL updatePickupRequest: an in-flight free pickup completes free while the holding plan is ACTIVE (control)", async () => {
    const { updatePickupRequest } = await import("../../functions/booking/pickupRequests.js");
    const { newMid } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(newMid).update({ pickupsUsed: 1, pickupsTotal: 2 });
    const bid = await seedCoveredBooking(newMid);
    await seedHeldPickup(newMid, bid);
    const res = (await updatePickupRequest.run({ data: { requestId: bid, status: "DONE" }, auth: adminAuth } as never)) as { status: string };
    expect(res.status).toBe("DONE");
    expect((await pickupDoc(bid))["memberMembershipId"]).toBe(newMid); // still free, hold kept
    expect((await membership(newMid)).pickupsUsed).toBe(1); // charged once, at confirm time only
  });

  it("REAL updatePickupRequest after the holding plan is REFUNDED: DONE fails closed, nothing charged or cancelled, staff alerted", async () => {
    const { updatePickupRequest } = await import("../../functions/booking/pickupRequests.js");
    const { newMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(newMid).update({ pickupsUsed: 1, pickupsTotal: 2 });
    const bid = await seedCoveredBooking(newMid);
    await seedHeldPickup(newMid, bid);
    expect((await processProviderEvent(db, refundEvent(p, 29900))).outcome).toBe("refunded");
    expect((await membership(newMid)).status).toBe("cancelled");
    // Refund-time alert: deterministic staff alert names the in-flight request.
    const alert = await db.collection(COLLECTIONS.staffAlerts()).doc(`membership_refund_inflight_pickup_${newMid}`).get();
    expect(alert.exists).toBe(true);
    expect((alert.data() as Record<string, unknown>)["requestIds"]).toEqual([bid]);
    // Execution-time guard: the request cannot go ahead free...
    await expect(
      updatePickupRequest.run({ data: { requestId: bid, status: "DONE" }, auth: adminAuth } as never),
    ).rejects.toThrow(/refunded/);
    // ...and progress recording is blocked too (fail closed until a person settles it)...
    await expect(
      updatePickupRequest.run({ data: { requestId: bid, status: "CONFIRMED", markLegCompleted: "pickup", agreedPickupAt: "2026-12-12 10:00", agreedDropAt: "2026-12-12 18:00" }, auth: adminAuth } as never),
    ).rejects.toThrow(/refunded/);
    // ...but nothing was mutated: still confirmed, still held, no charge.
    const after = await pickupDoc(bid);
    expect(after["status"]).toBe("CONFIRMED");
    expect(after["memberMembershipId"]).toBe(newMid);
    expect(after["feeBilled"]).toBe(false);
    // The release path stays open: staff can DECLINE, which hands the pickup back.
    const dec = (await updatePickupRequest.run({ data: { requestId: bid, status: "DECLINED" }, auth: adminAuth } as never)) as { status: string };
    expect(dec.status).toBe("DECLINED");
    expect((await pickupDoc(bid))["memberMembershipId"]).toBeNull();
  });

  it("concurrent REAL cancel + refund on the same covered booking: exactly one net outcome (4+3-1=6), one wash_restored", async () => {
    const { cancelBooking } = await import("../../functions/booking/cancelBooking.js");
    const { oldMid, newMid, p } = await seedUpgradePair(futureEnd());
    await db.collection(COLLECTIONS.memberships()).doc(oldMid).update({ washesTotal: 5, washesUsed: 4 });
    const bid = await seedCoveredBooking(newMid);
    const [outcome] = await Promise.all([
      processProviderEvent(db, refundEvent(p, 29900)),
      (async () => { try { await cancelBooking.run({ data: { bookingId: bid, reason: "changed plans" }, auth: customerAuthC1 } as never); } catch { /* may lose the race */ } })(),
    ]);
    expect(outcome.outcome).toBe("refunded");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("active");
    // Either interleaving nets the same: 4 + (3 - 1 cancelled) = 6. Never a minted credit, never a lost wash.
    expect(oldM.washesUsed).toBe(6);
    const washRestores = (await db.collection(COLLECTIONS.auditLog()).where("action", "==", "membership.wash_restored").get()).docs;
    expect(washRestores.length).toBe(1);
  });

  it("legacy initiateRefund full refund of an upgrade payment also restores the eligible predecessor", async () => {
    const end = futureEnd();
    const { oldMid, newMid, p } = await seedUpgradePair(end);
    const adminUser = { uid: "admin1", displayName: "Admin", email: null, claims: { role: "admin", tenantId: "t1", studioId: null } } as never;
    const { projectLegacyRefund } = await import("../../lib/refund-claims.js");
    await projectLegacyRefund(db, { paymentId: p.id, payment: p, providerRefundId: "rfnd_legacy_upg", reason: "admin refund", user: adminUser, now: new Date().toISOString() });
    expect((await membership(newMid)).status).toBe("cancelled");
    const oldM = await membership(oldMid);
    expect(oldM.status).toBe("active");
    expect(oldM.endDate).toBe(end);
    expect(oldM.washesUsed).toBe(5); // legacy path carries washes identically
    expect(await alertFor(p.id)).toBeUndefined();
  });
});

describe("upgrade restoration: shared-claim serialization (real entrypoints)", () => {
  const futureEnd = () => new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const alertFor = async (paymentId: string) =>
    (await db.collection(COLLECTIONS.staffAlerts()).doc(`membership_restore_uncertain_${paymentId}`).get()).data() as Record<string, unknown> | undefined;
  const claimDoc = async () => (await db.collection("membershipClaims").doc("t1_c1").get()).data() as Record<string, unknown> | undefined;
  const customerAuth = (authUid: string) => ({ uid: authUid, token: { role: "customer", tenantId: "t1", studioId: null }, rawToken: "test" });
  const staffAuth = { uid: "staff1", token: { role: "studio", tenantId: "t1", studioId: null }, rawToken: "test" };
  async function seedPlan(id: string, priceInPaise: number) {
    await db.collection(COLLECTIONS.membershipPlans()).doc(id).set({
      id, tenantId: "t1", name: `Plan ${id}`, tier: id, priceInPaise, includedWashes: 4,
      discountPercent: 10, freePickups: 1, prioritySlot: false, active: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }

  it("refund-restore vs REAL concurrent upgrade creation: exactly one wins, never double entitlement", async () => {
    const { upgradeMembership } = await import("../../functions/membership/upgradeMembership.js");
    const planA = uid("plan"), planB = uid("plan");
    await seedPlan(planA, 29900);
    await seedPlan(planB, 49900);
    const bMid = uid("m"), cMid = uid("m");
    await seedMembership(bMid, "cancelled", {
      cancellationReason: `upgraded_to:${cMid}`, cancelledAt: new Date().toISOString(), cancelledBy: "system",
      startDate: "2026-10-01", endDate: futureEnd(), washesUsed: 0, pickupsUsed: 0,
    });
    await seedMembership(cMid, "active", { upgradeFromMembershipId: bMid, planId: planA, washesUsed: 0, pickupsUsed: 0 });
    const bPay = membershipPayment(bMid);
    await db.collection(COLLECTIONS.payments()).doc(bPay.id).set(bPay);
    const cPay = membershipPayment(cMid);
    await db.collection(COLLECTIONS.payments()).doc(cPay.id).set(cPay);

    const [outcome, upgradeErr] = await Promise.all([
      processProviderEvent(db, refundEvent(cPay, 29900)),
      (async () => {
        try {
          await upgradeMembership.run({ data: { planId: planB, method: "cash", idempotencyKey: uid("idem") }, auth: customerAuth("c1") } as never);
          return null;
        } catch (e) { return e; }
      })(),
    ]);
    expect(outcome.outcome).toBe("refunded"); // the refund itself always projects
    expect((await membership(cMid)).status).toBe("cancelled");
    const restored = (await membership(bMid)).status === "active";
    const alerted = (await alertFor(cPay.id))?.["reason"] === "alert_other_plan_in_flight";
    const live = await db.collection(COLLECTIONS.memberships())
      .where("tenantId", "==", "t1").where("customerId", "==", "c1")
      .where("status", "in", ["pending", "active"]).get();
    const danglingFromRefunded = live.docs.filter((d) => (d.data() as { upgradeFromMembershipId?: string }).upgradeFromMembershipId === cMid);
    // Never double entitlement: restored predecessor AND a live upgrade chained on the refunded plan.
    expect(restored && danglingFromRefunded.length > 0).toBe(false);
    // Exactly one side won: restore (claim moved to the predecessor) or the
    // concurrent upgrade committed first and the restore failed closed + alerted.
    expect(restored).toBe(!alerted);
    if (alerted) {
      expect(danglingFromRefunded.length).toBe(1);
      expect((await membership(bMid)).status).toBe("cancelled");
      expect(upgradeErr).toBeNull();
    }
  });

  it("walkin creation writes the shared claim; a later purchase for that customer is refused", async () => {
    const { createWalkinMembership } = await import("../../functions/membership/createWalkinMembership.js");
    const { purchaseMembership } = await import("../../functions/membership/purchaseMembership.js");
    const plan = uid("plan");
    await seedPlan(plan, 29900);
    await db.collection(COLLECTIONS.customers()).doc("c1").set({ id: "c1", tenantId: "t1", name: "Claim Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const res = (await createWalkinMembership.run({ data: { customerId: "c1", planId: plan, method: "cash" }, auth: staffAuth } as never)) as { membershipId: string };
    expect((await claimDoc())?.["membershipId"]).toBe(res.membershipId);
    await expect(
      purchaseMembership.run({ data: { planId: plan, method: "cash", idempotencyKey: uid("k") }, auth: customerAuth("c1") } as never),
    ).rejects.toThrow();
  });

  it("a STALE claim (held membership cancelled) blocks nothing; creation moves the claim", async () => {
    const { createWalkinMembership } = await import("../../functions/membership/createWalkinMembership.js");
    const plan = uid("plan");
    await seedPlan(plan, 29900);
    await db.collection(COLLECTIONS.customers()).doc("c1").set({ id: "c1", tenantId: "t1", name: "Claim Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const oldMid = uid("m");
    await seedMembership(oldMid, "cancelled", { cancellationReason: "customer_requested", cancelledAt: new Date().toISOString() });
    await db.collection("membershipClaims").doc("t1_c1").set({ tenantId: "t1", customerId: "c1", membershipId: oldMid, updatedAt: new Date().toISOString() });
    const res = (await createWalkinMembership.run({ data: { customerId: "c1", planId: plan, method: "cash" }, auth: staffAuth } as never)) as { membershipId: string };
    expect((await claimDoc())?.["membershipId"]).toBe(res.membershipId);
    expect((await membership(res.membershipId)).status).toBe("active"); // cash walkin activates immediately
  });
});

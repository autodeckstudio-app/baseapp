/**
 * RIG: deployed (unguarded) recordManualPayment/initiatePayment/advanceJobStatus
 * (byte-identical to the 17 Oct production bundles) racing the proposed
 * settleMembershipCoveredJob (a04d1450). Seeding copied from
 * membership-covered.emulator.test.ts (synthetic covered linkage fixture).
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { settleMembershipCoveredJob } from "../../functions/job/settleMembershipCoveredJob.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
const db = getFirestore();
let n = 0;
const auth = (role = "admin", tenantId = "covered", studioId: string | null = null) => ({
  uid: "staff",
  token: { role, tenantId, studioId },
});
const studioAuth = () => auth("studio", "covered", "s");
const runSettle = (id: string) => settleMembershipCoveredJob.run({ data: { jobId: id }, auth: auth() } as never);
const runCash = (id: string) =>
  recordManualPayment.run({ data: { jobId: id, method: "cash" }, auth: studioAuth() } as never);
async function seed() {
  const id = `covered-${Date.now()}-${++n}`,
    now = new Date().toISOString(),
    pb = {
      vehicleCategory: "hatchback", basePrice: 100000, scopeAdjustment: 0, addOns: [],
      subtotal: 100000, membershipDiscount: 100000, membershipDiscountPercent: null,
      pickupFee: 0, dropFee: 0, taxRatePercent: 18, taxDescription: "GST 18%", tax: 0,
      total: 0, currency: "INR",
    };
  const common = {
    tenantId: "covered", studioId: "s", customerId: "c", vehicleId: id, serviceId: id,
    totalAmount: 0, priceBreakdown: pb, createdAt: now, updatedAt: now, paymentStatus: "unpaid",
  };
  await db.collection("bookings").doc(id).set({
    ...common, id, status: "CONFIRMED", membershipId: id, membershipWashUsed: true,
    membershipDiscountApplied: true, scheduledAt: now,
  });
  await db.collection("jobs").doc(id).set({
    ...common, membershipWashUsed: true, id, bookingId: id, status: "READY_FOR_DELIVERY",
    isWalkIn: false, additionalWorkDelta: 0, statusHistory: [], estimatedEndAt: now,
  });
  await db.collection("memberships").doc(id).set({
    id, tenantId: "covered", customerId: "c", status: "expired", washesUsed: 1, washesTotal: 1,
  });
  await db.collection("memberships").doc(id).collection("usage").doc("wash").set({
    id: "wash", tenantId: "covered", membershipId: id, customerId: "c", usageType: "wash",
    jobId: id, bookingId: id, valueRedeemed: 100000, usedAt: now,
  });
  await db.collection("services").doc(id).set({
    id, tenantId: "covered", name: "Covered test wash", membershipWashEligible: true,
  });
  return id;
}
const get = async (c: string, id: string) => (await db.collection(c).doc(id).get()).data()!;
const paymentsFor = async (id: string) =>
  (await db.collection("payments").where("jobId", "==", id).get()).docs.map((d) => d.data());
const invoicesFor = async (id: string) =>
  (await db.collection("invoices").where("jobId", "==", id).get()).docs.map((d) => d.data());

describe("settle vs DEPLOYED unguarded handlers (race matrix)", () => {
  it("R1: old Rs0 cash first -> settle rejects; wash linkage stays unset (KNOWN divergence)", async () => {
    const id = await seed();
    await runCash(id);
    await expect(runSettle(id)).rejects.toThrow(/payment or additional work/i);
    const job = await get("jobs", id);
    expect(job.paymentStatus).toBe("paid");
    expect(job.settlementKind ?? null).toBeNull(); // old path never marks covered settlement
    expect((await paymentsFor(id)).length).toBe(1);
  });

  it("R2: settle first -> old cash rejects; covered invariants exact", async () => {
    const id = await seed();
    const r = (await runSettle(id)) as { invoiceId: string; alreadySettled: boolean };
    expect(r.alreadySettled).toBe(false);
    await expect(runCash(id)).rejects.toThrow(/already been marked as paid/i);
    const job = await get("jobs", id), booking = await get("bookings", id);
    expect(job.paymentStatus).toBe("paid");
    expect(job.settlementKind).toBe("membership_covered");
    expect(booking.paymentStatus).toBe("paid");
    expect(booking.settlementKind).toBe("membership_covered");
    expect((await paymentsFor(id)).length).toBe(0);
    const live = (await invoicesFor(id)).filter((i) => i.status !== "void");
    expect(live.length).toBe(1);
    expect(live[0].total).toBe(0);
    // idempotent second settle
    const r2 = (await runSettle(id)) as { alreadySettled: boolean };
    expect(r2.alreadySettled).toBe(true);
  });

  it("R3: concurrent settle + old cash -> exactly one winner, consistent final state", async () => {
    for (let i = 0; i < 5; i++) {
      const id = await seed();
      const [s, c] = await Promise.allSettled([runSettle(id), runCash(id)]);
      const wins = [s, c].filter((x) => x.status === "fulfilled").length;
      expect(wins, `iteration ${i}: exactly one winner`).toBe(1);
      const job = await get("jobs", id);
      const pays = await paymentsFor(id);
      expect(job.paymentStatus).toBe("paid");
      if (s.status === "fulfilled") {
        expect(job.settlementKind).toBe("membership_covered");
        expect(pays.length, `iteration ${i}: settle won, no payment doc`).toBe(0);
      } else {
        expect(job.settlementKind ?? null, `iteration ${i}: cash won, no settlementKind`).toBeNull();
        expect(pays.length).toBe(1);
      }
    }
  });

  it("R4: link issued on covered job (zero guard in deployed handler) -> settle BLOCKED by pending payment", async () => {
    const id = await seed();
    const r = (await initiatePayment.run({
      data: { jobId: id, method: "razorpay_payment_link" },
      auth: studioAuth(),
    } as never)) as { paymentId: string; status: string };
    // Deployed initiatePayment has NO covered guard: it happily claims a payment slot.
    const pays = await paymentsFor(id);
    expect(pays.length).toBe(1);
    expect(pays[0].amount).toBe(0); // covered job total
    // settle refuses while ANY payment doc exists:
    await expect(runSettle(id)).rejects.toThrow(/payment or additional work/i);
    expect((await get("jobs", id)).paymentStatus).toBe("unpaid");
  });

  it("R5: tampered positive total -> settle rejects, no invoice/payment writes", async () => {
    const id = await seed();
    await db.collection("jobs").doc(id).update({ totalAmount: 50000 });
    await expect(runSettle(id)).rejects.toThrow(); // any rejection: no covered invoice for tampered/uncovered-valid linkage
    expect((await paymentsFor(id)).length).toBe(0);
    expect((await invoicesFor(id)).length).toBe(0);
    expect((await get("jobs", id)).paymentStatus).toBe("unpaid");
  });

  it("R6: stale positive open link -> settle rejects; link paid after -> money lands on covered job (hole)", async () => {
    const id = await seed();
    const pid = id + "-stale";
    await db.collection("payments").doc(pid).set({
      id: pid, jobId: id, bookingId: id, tenantId: "covered", studioId: "s", customerId: "c",
      method: "razorpay_payment_link", status: "pending", amount: 100000, currency: "INR",
      razorpayPaymentLinkId: pid, razorpayPaymentId: null,
    });
    await expect(runSettle(id)).rejects.toThrow(/payment or additional work/i);
    await processProviderEvent(db, {
      eventType: "payment_link.paid", providerEventId: pid, providerPaymentLinkId: pid,
      providerPaymentId: pid, referenceId: pid, amount: 100000, currency: "INR",
    } as never);
    const payment = await get("payments", pid);
    const job = await get("jobs", id);
    expect(payment.status).toBe("completed"); // money collected
    // OBSERVE (no assertion on desired state): job now paid-by-money on a covered wash
    console.log("R6 post-capture job:", job.paymentStatus, job.settlementKind ?? null);
  });

  it("R7: concurrent settle + settle -> exactly one invoice, both calls coherent", async () => {
    const id = await seed();
    const [a, b] = await Promise.allSettled([runSettle(id), runSettle(id)]);
    const oks = [a, b].filter((x) => x.status === "fulfilled").length;
    expect(oks >= 1).toBe(true);
    const live = (await invoicesFor(id)).filter((i) => i.status !== "void");
    expect(live.length).toBe(1);
    const job = await get("jobs", id);
    expect(job.settlementKind).toBe("membership_covered");
  });
});

// ---------------------------------------------------------------------------
// TRANSITION matrix: the coordinated rollout has a window where the NEW settle
// endpoint is live while the DEPLOYED (unguarded) rMP/aJS still are. These pin
// that window: no zero-payment after settle, no duplicate invoices, no wash
// counter drift, old route remains truthful when it wins.
// ---------------------------------------------------------------------------
it("T1 transition: old zero route closes a covered job; settle then fails closed, one invoice, no counter drift", async () => {
  const id = await seed();
  const cash = (await runCash(id)) as { paymentId: string };
  expect(cash.paymentId).toBeTruthy();
  expect((await get("jobs", id)).paymentStatus).toBe("paid");
  const live1 = (await invoicesFor(id)).filter((i) => i.status !== "void");
  expect(live1.length).toBe(1);
  expect(Number(live1[0]!.total)).toBe(0);
  // settle fails closed on the old-route residue (payment pre-check fires before the invoice check)
  await expect(runSettle(id)).rejects.toThrow(/already settled|settlement linkage|payment or additional work exists/i);
  expect((await invoicesFor(id)).filter((i) => i.status !== "void").length).toBe(1);
  expect(Number((await get("memberships", id)).washesUsed)).toBe(1);
});

it("T2 transition: settle first; deployed rMP rejects already-paid; non-void invoice satisfies the deployed aJS delivery precondition", async () => {
  const id = await seed();
  const r = (await runSettle(id)) as { invoiceId: string; alreadySettled: boolean };
  expect(r.alreadySettled).toBe(false);
  await expect(runCash(id)).rejects.toThrow(/already been marked as paid/);
  const live = (await invoicesFor(id)).filter((i) => i.status !== "void");
  expect(live.length).toBe(1); // what the DEPLOYED advanceJobStatus requires before delivery
  expect((await get("jobs", id)).paymentStatus).toBe("paid");
  expect((await get("bookings", id)).paymentStatus).toBe("paid");
  expect(Number((await get("memberships", id)).washesUsed)).toBe(1);
});

it("T3 transition: deployed rMP racing settle collapses to exactly one live invoice and exactly one winner", async () => {
  const id = await seed();
  const pair = await Promise.allSettled([runCash(id), runSettle(id)]);
  expect(pair.filter((x) => x.status === "fulfilled").length).toBe(1);
  const live = (await invoicesFor(id)).filter((i) => i.status !== "void");
  expect(live.length).toBe(1);
  expect(Number((await get("memberships", id)).washesUsed)).toBe(1);
});

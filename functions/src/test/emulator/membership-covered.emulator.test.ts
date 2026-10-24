import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { settleMembershipCoveredJob } from "../../functions/job/settleMembershipCoveredJob.js";
import { voidInvoice } from "../../functions/invoice/voidInvoice.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";
const db = getFirestore();
let n = 0;
const auth = (role = "admin", tenantId = "covered", studioId: string | null = null) => ({
  uid: "staff",
  token: { role, tenantId, studioId },
});
const run = (id: string, a = auth()) =>
  settleMembershipCoveredJob.run({ data: { jobId: id }, auth: a } as never);
async function seed() {
  const id = `covered-${Date.now()}-${++n}`,
    now = new Date().toISOString(),
    pb = {
      vehicleCategory: "hatchback",
      basePrice: 100000,
      scopeAdjustment: 0,
      addOns: [],
      subtotal: 100000,
      membershipDiscount: 100000,
      membershipDiscountPercent: null,
      pickupFee: 0,
      dropFee: 0,
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      tax: 0,
      total: 0,
      currency: "INR",
    };
  const common = {
    tenantId: "covered",
    studioId: "s",
    customerId: "c",
    vehicleId: id,
    serviceId: id,
    totalAmount: 0,
    priceBreakdown: pb,
    createdAt: now,
    updatedAt: now,
    paymentStatus: "unpaid",
  };
  await db
    .collection("bookings")
    .doc(id)
    .set({
      ...common,
      id,
      status: "CONFIRMED",
      membershipId: id,
      membershipWashUsed: true,
      membershipDiscountApplied: true,
      scheduledAt: now,
    });
  await db
    .collection("jobs")
    .doc(id)
    .set({
      ...common,
      membershipWashUsed: true,
      id,
      bookingId: id,
      status: "READY_FOR_DELIVERY",
      isWalkIn: false,
      additionalWorkDelta: 0,
      statusHistory: [],
      estimatedEndAt: now,
    });
  await db.collection("memberships").doc(id).set({
    id,
    tenantId: "covered",
    customerId: "c",
    status: "expired",
    washesUsed: 1,
    washesTotal: 1,
  });
  await db.collection("memberships").doc(id).collection("usage").doc("wash").set({
    id: "wash",
    tenantId: "covered",
    membershipId: id,
    customerId: "c",
    usageType: "wash",
    jobId: id,
    bookingId: id,
    valueRedeemed: 100000,
    usedAt: now,
  });
  await db.collection("services").doc(id).set({
    id,
    tenantId: "covered",
    name: "Covered test wash",
    membershipWashEligible: true,
  });
  return id;
}
const get = async (c: string, id: string) => (await db.collection(c).doc(id).get()).data()!;
describe("membership-covered zero settlement (synthetic linkage fixtures)", () => {
  it("issues zero invoice without Payment or credit mutation; exact duplicate idempotent; delivery validates linkage", async () => {
    const id = await seed();
    const before = await get("memberships", id);
    const result = (await run(id)) as { invoiceId: string };
    expect(await get("invoices", result.invoiceId)).toMatchObject({
      status: "issued",
      total: 0,
      paymentId: null,
      settlementKind: "membership_covered",
      membershipId: id,
    });
    expect((await db.collection("payments").where("jobId", "==", id).get()).empty).toBe(true);
    expect(await get("memberships", id)).toEqual(before);
    expect(await run(id)).toMatchObject({
      alreadySettled: true,
      invoiceId: result.invoiceId,
    });
    await advanceJobStatus.run({ data: { jobId: id }, auth: auth() } as never);
    expect((await get("jobs", id)).status).toBe("DELIVERED");
  });
  it("denies customer/accountant/other tenant/other studio", async () => {
    for (const a of [
      auth("customer"),
      auth("accountant"),
      auth("admin", "other"),
      auth("studio", "covered", "other"),
    ]) {
      const id = await seed();
      await expect(run(id, a)).rejects.toMatchObject({
        code: "permission-denied",
      });
    }
  });
  for (const [label, col, patch] of [
    ["nonzero job", "jobs", { totalAmount: 1 }],
    ["nonzero snapshot", "jobs", { priceBreakdown: { total: 1 } }],
    ["cancelled job", "jobs", { status: "CANCELLED" }],
    ["cancelled restored booking", "bookings", { status: "CANCELLED" }],
    ["expired booking", "bookings", { status: "EXPIRED" }],
    ["wrong customer", "bookings", { customerId: "other" }],
    ["wrong studio", "bookings", { studioId: "other" }],
    ["wrong service", "bookings", { serviceId: "other" }],
    ["gift", "bookings", { giftId: "gift" }],
    ["lying job snapshot", "bookings", { membershipWashUsed: false }],
    ["extra work", "jobs", { additionalWorkDelta: 1 }],
    ["forged marker", "jobs", { settlementKind: "membership_covered", paymentStatus: "paid" }],
  ] as const)
    it(`denies ${label}`, async () => {
      const id = await seed();
      await db.collection(col).doc(id).update(patch);
      await expect(run(id)).rejects.toMatchObject({
        code: "failed-precondition",
      });
      expect((await db.collection("invoices").where("jobId", "==", id).get()).empty).toBe(true);
    });
  it("denies missing/mismatched usage, existing payment and pending approval", async () => {
    for (const kind of ["missing", "wrong", "payment", "approval"]) {
      const id = await seed();
      if (kind === "missing") await db.collection(`memberships/${id}/usage`).doc("wash").delete();
      if (kind === "wrong")
        await db.collection(`memberships/${id}/usage`).doc("wash").update({ jobId: "other" });
      if (kind === "payment")
        await db.collection("payments").doc(id).set({ jobId: id, status: "pending" });
      if (kind === "approval")
        await db.collection("approvals").doc(id).set({ jobId: id, status: "pending" });
      await expect(run(id)).rejects.toMatchObject({
        code: "failed-precondition",
      });
    }
  });
  it("zero money paths reject and unlinked zero delivery denies", async () => {
    const id = await seed();
    for (const fn of [recordManualPayment, initiatePayment])
      await expect(
        fn.run({
          data: {
            jobId: id,
            method: fn === recordManualPayment ? "cash" : "razorpay_payment_link",
          },
          auth: auth(),
        } as never),
      ).rejects.toMatchObject({ code: "failed-precondition" });
    await db.collection("jobs").doc(id).update({ paymentStatus: "paid" });
    await db
      .collection("invoices")
      .doc(id)
      .set({ jobId: id, tenantId: "covered", status: "issued" });
    await expect(
      advanceJobStatus.run({ data: { jobId: id }, auth: auth() } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("late capture remains real receipt+anomaly without changing covered invoice/job", async () => {
    const id = await seed();
    const r = (await run(id)) as { invoiceId: string };
    const before = await get("jobs", id),
      inv = await get("invoices", r.invoiceId);
    const pid = id + "-late";
    await db.collection("payments").doc(pid).set({
      id: pid,
      jobId: id,
      bookingId: id,
      tenantId: "covered",
      studioId: "s",
      customerId: "c",
      method: "razorpay_payment_link",
      status: "pending",
      amount: 100000,
      currency: "INR",
      razorpayPaymentLinkId: pid,
      razorpayPaymentId: pid,
    });
    await processProviderEvent(db, {
      eventType: "payment_link.paid",
      providerEventId: pid,
      providerPaymentLinkId: pid,
      providerPaymentId: pid,
      referenceId: pid,
      amount: 100000,
      currency: "INR",
    } as never);
    expect((await get("payments", pid)).status).toBe("completed");
    expect(await get("jobs", id)).toEqual(before);
    expect(await get("invoices", r.invoiceId)).toEqual(inv);
  });

  it("rejects covered void with no invoice/audit write; ordinary issued invoice still voids", async () => {
    const id = await seed();
    const r = (await run(id)) as { invoiceId: string };
    const before = await get("invoices", r.invoiceId),
      audits = async () =>
        (await db.collection("auditLog").where("entityId", "==", r.invoiceId).get()).docs.map((d) =>
          d.data(),
        );
    const ab = await audits();
    await expect(
      voidInvoice.run({
        data: { invoiceId: r.invoiceId, reason: "covered guard probe" },
        auth: auth(),
      } as never),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Membership-covered invoices cannot be voided.",
    });
    expect(await get("invoices", r.invoiceId)).toEqual(before);
    expect(await audits()).toEqual(ab);
    const normal = id + "-normal";
    const { settlementKind: _, membershipId: __, ...ordinary } = before;
    await db
      .collection("invoices")
      .doc(normal)
      .set({ ...ordinary, id: normal, total: 90000 });
    await voidInvoice.run({
      data: { invoiceId: normal, reason: "ordinary control" },
      auth: auth(),
    } as never);
    expect((await get("invoices", normal)).status).toBe("void");
    const ordinaryAudits = await db.collection("auditLog").where("entityId", "==", normal).get();
    expect(ab.length).toBe(0);
    expect((await audits()).length).toBe(0);
    expect(ordinaryAudits.size).toBe(1);
    expect(ordinaryAudits.docs[0]!.data()["action"]).toBe("invoice.voided");
    console.log(
      "NO-WRITE POSITIVE CONTROL auditLog coveredBefore=0 coveredAfter=0 ordinaryVoidAfter=" +
        ordinaryAudits.size,
    );
  });
  it("covered delivery rejects unpaid first and paid with void invoice linkage", async () => {
    const id = await seed();
    const invoke = () => advanceJobStatus.run({ data: { jobId: id }, auth: auth() } as never);
    await expect(invoke()).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Collect and confirm full payment before delivering this vehicle.",
    });
    console.log(
      "COVERED unpaid denial: Collect and confirm full payment before delivering this vehicle.",
    );
    const r = (await run(id)) as { invoiceId: string };
    await db.collection("invoices").doc(r.invoiceId).update({ status: "void" });
    await expect(invoke()).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Membership-covered invoice linkage is invalid.",
    });
    console.log(
      "COVERED paid+synthetic void denial: Membership-covered invoice linkage is invalid.",
    );
  });
  it("covered limiter increments and normal retry stays idempotent; exhaustion denies", async () => {
    const id = await seed(),
      a = { uid: id, token: { role: "admin", tenantId: "covered", studioId: null } },
      ref = db.collection("rateLimits").doc(`covered__${id}__job.settleMembershipCovered`);
    const first = await run(id, a);
    expect((await ref.get()).data()?.count).toBe(1);
    expect(await run(id, a)).toMatchObject({ ...first, alreadySettled: true });
    expect((await ref.get()).data()?.count).toBe(2);
    await ref.update({ count: 60 });
    await expect(run(id, a)).rejects.toMatchObject({ code: "resource-exhausted" });
    console.log(
      "COVERED limiter counts1->2, normal idempotent retry same invoice, count60 resource-exhausted",
    );
  });
  it("assertStudio allows own-studio/admin/superadmin and denies mismatch", async () => {
    for (const a of [
      auth("studio", "covered", "s"),
      auth("admin", "covered", "other"),
      auth("superadmin", "covered", "other"),
    ]) {
      const id = await seed();
      await expect(run(id, a)).resolves.toMatchObject({ alreadySettled: false });
    }
    const id = await seed();
    await expect(run(id, auth("studio", "covered", "other"))).rejects.toMatchObject({
      code: "permission-denied",
      message: "Job belongs to a different studio.",
    });
  });
});

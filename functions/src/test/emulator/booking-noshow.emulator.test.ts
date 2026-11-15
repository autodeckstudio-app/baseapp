/**
 * Emulator tests for no-show resolution through the real callables, documents seeded directly. Local only: the
 * refund outbox is a RESERVATION (never submitted here, no provider call). Mapped default (owner-approved 2 Nov):
 * 20% of the discounted service including GST excluding pickup/drop when the price snapshot exists; no snapshot has
 * NO default (office review); the flat/percent bands stay explicit admin candidates; deviations are a labelled exception; waive is logged.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { previewNoShowResolution, resolveNoShow } from "../../functions/booking/noShowReview.js";

const db = getFirestore();
const TENANT = "ns-tenant";
const STUDIO = "ns-studio";
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${(seq += 1)}`;
const admin = () => ({ uid: uid("admin"), token: { role: "admin", tenantId: TENANT, studioId: null }, rawToken: "t" });
const customer = () => ({ uid: uid("c"), token: { role: "customer", tenantId: TENANT, studioId: null }, rawToken: "t" });

async function seed(o: { category: string | null; total: number; paid: number; method?: string; snapshot?: boolean }) {
  const now = new Date().toISOString();
  const bookingId = uid("bk");
  await db.collection("bookings").doc(bookingId).set({
    id: bookingId, tenantId: TENANT, studioId: STUDIO, customerId: uid("cu"), status: "CANCELLED", missedAt: now,
    scheduledAt: new Date(Date.now() - 3600000).toISOString(), totalAmount: o.total,
    // Subtotal INCLUDES pickup+drop; the approved basis excludes all transport and the membership discount.
    ...(o.snapshot ? { priceBreakdown: { subtotal: o.total + 10000, pickupFee: 5000, dropFee: 5000, membershipDiscount: 10000, taxRatePercent: 0, tax: 0, total: o.total } } : {}),
    ...(o.category ? { cancelCategories: [o.category] } : {}), createdAt: now, updatedAt: now,
  });
  let paymentId: string | null = null;
  if (o.paid > 0) {
    paymentId = uid("pay");
    await db.collection("payments").doc(paymentId).set({
      id: paymentId, tenantId: TENANT, studioId: STUDIO, bookingId, jobId: null, customerId: uid("cu"), amount: o.paid, currency: "INR",
      method: o.method ?? "razorpay_payment_link", status: "completed", razorpayPaymentId: "rzp_fixture", refundAmount: null, createdAt: now, updatedAt: now,
    });
  }
  return { bookingId, paymentId };
}
const preview = (bookingId: string) => previewNoShowResolution.run({ data: { bookingId }, auth: admin() } as never) as Promise<any>;
const resolve = (data: Record<string, unknown>, auth: unknown = admin()) => resolveNoShow.run({ data, auth } as never) as Promise<any>;
const bk = async (id: string) => (await db.collection("bookings").doc(id).get()).data() as Record<string, any>;

describe("no-show resolution (fixture money, reservation only)", () => {
  it("preview maps the approved discounted-service basis when the price snapshot exists, and otherwise preselects nothing", async () => {
    // service = 110000 - 5000 pickup - 5000 drop - 10000 discount = 90000; 20% = 18000, refund 82000 (GST disabled).
    const a = await seed({ category: "washing", total: 100000, paid: 100000, snapshot: true });
    expect((await preview(a.bookingId)).mappedDefault).toEqual({ serviceClass: "service_only", key: "service_20", chargePaise: 18000, refundPaise: 82000 });
    const bare = await seed({ category: "ppf", total: 500000, paid: 500000 });
    const p = await preview(bare.bookingId);
    expect(p.mappedDefault).toBeNull();
    expect(p.candidates.map((c: { key: string }) => c.key)).toEqual(["flat_rs100", "pct_20", "waive"]); // explicit admin choices, unchanged
  });

  it("unknown service class has no default and a charge without an amount is refused (no silent charge)", async () => {
    const s = await seed({ category: null, total: 100000, paid: 100000 });
    expect((await preview(s.bookingId)).mappedDefault).toBeNull();
    await expect(resolve({ bookingId: s.bookingId, resolution: "charge", reason: "no show" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect((await bk(s.bookingId))["noShowResolution"]).toBeUndefined();
  });

  it("charge with no amount applies the mapped default and reserves captured minus charge (a reservation, not a refund)", async () => {
    const s = await seed({ category: "ppf", total: 500000, paid: 500000, snapshot: true });
    // service = 510000 - 5000 - 5000 - 10000 = 490000; 20% = 98000, refund 402000.
    const r = await resolve({ bookingId: s.bookingId, resolution: "charge", reason: "no contact" });
    expect(r).toMatchObject({ resolved: true, chargePaise: 98000 });
    const rr = (await db.collection("refundRequests").doc(r.refundRequestId).get()).data()!;
    expect(rr).toMatchObject({ amountPaise: 402000, status: "reserved", paymentId: s.paymentId });
    expect(rr["providerRefundId"]).toBeNull();
    expect(await bk(s.bookingId)).toMatchObject({ noShowResolution: "charge", noShowChargePaise: 98000, noShowMappedDefaultPaise: 98000, refundStatus: "reserved", cancellationFeeStatus: "withheld" });
    expect((await bk(s.bookingId))["noShowChargeException"]).toBeUndefined();
    expect((await db.collection("payments").doc(s.paymentId!).get()).data()).toMatchObject({ status: "completed", refundAmount: null });
  });

  it("a charge that differs from the mapped default is recorded as a labelled exception", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000, snapshot: true });
    await resolve({ bookingId: s.bookingId, resolution: "charge", chargePaise: 25000, reason: "customer agreed by phone" });
    expect(await bk(s.bookingId)).toMatchObject({ noShowChargePaise: 25000, noShowMappedDefaultPaise: 18000, noShowChargeException: true, noShowReason: "customer agreed by phone" });
  });

  it("waive refunds nothing inline, reserves the full amount and is marked waived", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000 });
    const r = await resolve({ bookingId: s.bookingId, resolution: "waive", reason: "goodwill, studio fault" });
    const rr = (await db.collection("refundRequests").doc(r.refundRequestId).get()).data()!;
    expect(rr).toMatchObject({ amountPaise: 100000, status: "reserved" });
    expect(await bk(s.bookingId)).toMatchObject({ cancellationFeeStatus: "waived", noShowChargePaise: 0 });
  });

  it("a second resolution is refused and creates no second reservation", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000, snapshot: true });
    await resolve({ bookingId: s.bookingId, resolution: "charge", reason: "no contact" });
    await expect(resolve({ bookingId: s.bookingId, resolution: "waive", reason: "changed mind" })).rejects.toMatchObject({ code: "already-exists" });
    const reqs = await db.collection("refundRequests").where("paymentId", "==", s.paymentId).get();
    expect(reqs.docs.filter((d) => d.id.startsWith("rr_")).length).toBe(1); // the other doc is the active_ guard
  });

  it("a customer cannot preview or resolve", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000 });
    await expect(resolve({ bookingId: s.bookingId, resolution: "waive", reason: "x y z" }, customer())).rejects.toMatchObject({ code: "permission-denied" });
    await expect(previewNoShowResolution.run({ data: { bookingId: s.bookingId }, auth: customer() } as never)).rejects.toMatchObject({ code: "permission-denied" });
    expect((await bk(s.bookingId))["noShowResolution"]).toBeUndefined();
  });

  it("charge above the captured amount is refused; manual-payment refund is refused; reopen is held", async () => {
    const a = await seed({ category: "washing", total: 100000, paid: 100000 });
    await expect(resolve({ bookingId: a.bookingId, resolution: "charge", chargePaise: 200000, reason: "too much" })).rejects.toMatchObject({ code: "invalid-argument" });
    const c = await seed({ category: "washing", total: 100000, paid: 100000, method: "cash", snapshot: true });
    await expect(resolve({ bookingId: c.bookingId, resolution: "charge", reason: "cash no show" })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(resolve({ bookingId: a.bookingId, resolution: "reopen", reason: "try reopen" })).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await bk(a.bookingId))["noShowResolution"]).toBeUndefined();
  });

  it("a missing or too-short reason is refused for charge, waive and exception, with no state change", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000 });
    for (const reason of [undefined, "", "  ", "ab"]) {
      const data: Record<string, unknown> = { bookingId: s.bookingId, resolution: "waive" };
      if (reason !== undefined) data["reason"] = reason;
      await expect(resolve(data)).rejects.toMatchObject({ code: "invalid-argument" });
    }
    await expect(resolve({ bookingId: s.bookingId, resolution: "charge", chargePaise: 25000, reason: "x" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect((await bk(s.bookingId))["noShowResolution"]).toBeUndefined();
    expect((await db.collection("refundRequests").where("paymentId", "==", s.paymentId).get()).size).toBe(0);
  });

  it("the audit entry carries the admin actor, the reason, the mapped default and the exception flag", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000, snapshot: true });
    const auth = admin();
    await resolve({ bookingId: s.bookingId, resolution: "charge", chargePaise: 25000, reason: "customer agreed by phone" }, auth);
    const logs = await db.collection("auditLog").where("entityId", "==", s.bookingId).where("action", "==", "booking.noshow_resolved").get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0]!.data()).toMatchObject({
      performedBy: auth.uid, performedByRole: "admin",
      after: { resolution: "charge", chargePaise: 25000, reason: "customer agreed by phone", mappedDefaultPaise: 18000, exception: true },
    });
    expect((await bk(s.bookingId))["noShowResolvedBy"]).toBe(auth.uid);
  });
});

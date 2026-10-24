/**
 * Emulator tests for no-show resolution through the real callables, documents seeded directly. Local only: the
 * refund outbox is a RESERVATION (never submitted here, no provider call). Mapped default: small Rs 100, bigger 20%
 * of the booking total; unknown class has no default; deviations are a labelled exception; waive is logged.
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

async function seed(o: { category: string | null; total: number; paid: number; method?: string }) {
  const now = new Date().toISOString();
  const bookingId = uid("bk");
  await db.collection("bookings").doc(bookingId).set({
    id: bookingId, tenantId: TENANT, studioId: STUDIO, customerId: uid("cu"), status: "CANCELLED", missedAt: now,
    scheduledAt: new Date(Date.now() - 3600000).toISOString(), totalAmount: o.total,
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
  it("preview maps small to Rs 100 and bigger to 20% of the total, and preselects nothing else", async () => {
    const a = await seed({ category: "washing", total: 100000, paid: 100000 });
    expect((await preview(a.bookingId)).mappedDefault).toEqual({ serviceClass: "small", key: "flat_rs100", chargePaise: 10000, refundPaise: 90000 });
    const b = await seed({ category: "ppf", total: 500000, paid: 500000 });
    expect((await preview(b.bookingId)).mappedDefault).toEqual({ serviceClass: "bigger", key: "pct_20", chargePaise: 100000, refundPaise: 400000 });
  });

  it("unknown service class has no default and a charge without an amount is refused (no silent charge)", async () => {
    const s = await seed({ category: null, total: 100000, paid: 100000 });
    expect((await preview(s.bookingId)).mappedDefault).toBeNull();
    await expect(resolve({ bookingId: s.bookingId, resolution: "charge", reason: "no show" })).rejects.toMatchObject({ code: "invalid-argument" });
    expect((await bk(s.bookingId))["noShowResolution"]).toBeUndefined();
  });

  it("charge with no amount applies the mapped default and reserves captured minus charge (a reservation, not a refund)", async () => {
    const s = await seed({ category: "ppf", total: 500000, paid: 500000 });
    const r = await resolve({ bookingId: s.bookingId, resolution: "charge", reason: "no contact" });
    expect(r).toMatchObject({ resolved: true, chargePaise: 100000 });
    const rr = (await db.collection("refundRequests").doc(r.refundRequestId).get()).data()!;
    expect(rr).toMatchObject({ amountPaise: 400000, status: "reserved", paymentId: s.paymentId });
    expect(rr["providerRefundId"]).toBeNull();
    expect(await bk(s.bookingId)).toMatchObject({ noShowResolution: "charge", noShowChargePaise: 100000, noShowMappedDefaultPaise: 100000, refundStatus: "reserved", cancellationFeeStatus: "withheld" });
    expect((await bk(s.bookingId))["noShowChargeException"]).toBeUndefined();
    expect((await db.collection("payments").doc(s.paymentId!).get()).data()).toMatchObject({ status: "completed", refundAmount: null });
  });

  it("a charge that differs from the mapped default is recorded as a labelled exception", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000 });
    await resolve({ bookingId: s.bookingId, resolution: "charge", chargePaise: 25000, reason: "customer agreed by phone" });
    expect(await bk(s.bookingId)).toMatchObject({ noShowChargePaise: 25000, noShowMappedDefaultPaise: 10000, noShowChargeException: true, noShowReason: "customer agreed by phone" });
  });

  it("waive refunds nothing inline, reserves the full amount and is marked waived", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000 });
    const r = await resolve({ bookingId: s.bookingId, resolution: "waive", reason: "goodwill, studio fault" });
    const rr = (await db.collection("refundRequests").doc(r.refundRequestId).get()).data()!;
    expect(rr).toMatchObject({ amountPaise: 100000, status: "reserved" });
    expect(await bk(s.bookingId)).toMatchObject({ cancellationFeeStatus: "waived", noShowChargePaise: 0 });
  });

  it("a second resolution is refused and creates no second reservation", async () => {
    const s = await seed({ category: "washing", total: 100000, paid: 100000 });
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
    const c = await seed({ category: "washing", total: 100000, paid: 100000, method: "cash" });
    await expect(resolve({ bookingId: c.bookingId, resolution: "charge", reason: "cash no show" })).rejects.toMatchObject({ code: "failed-precondition" });
    await expect(resolve({ bookingId: a.bookingId, resolution: "reopen", reason: "try reopen" })).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await bk(a.bookingId))["noShowResolution"]).toBeUndefined();
  });
});

// Track A2: no-show admin review handlers (fresh, fake store + mocked middleware).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "./fake-firestore.js";

const h = vi.hoisted(() => ({ db: null as any, data: null as any }));
vi.mock("../../middleware/auth.js", () => ({
  extractUser: () => ({ uid: "admin1", claims: { tenantId: "t1", role: "admin", studioId: "s1" } }),
  assertTenant: vi.fn(), assertStudio: vi.fn(), assertRole: vi.fn(),
}));
vi.mock("../../middleware/rateLimit.js", () => ({ enforceRateLimit: vi.fn(), subjectFrom: () => "admin1" }));
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => h.db }));

import { recordNoShowContact, previewNoShowResolution, resolveNoShow } from "../../functions/booking/noShowReview.js";

const missedBooking = {
  id: "b1", tenantId: "t1", studioId: "s1", customerId: "c1", status: "CANCELLED",
  missedAt: "2026-10-22T15:30:00.000Z", cancelledBy: "system",
  cancellationFeePaise: 10000, cancellationFeeStatus: "due", scheduledAt: "2026-10-22T04:00:00.000Z",
};
const paidPayment = {
  id: "pay1", tenantId: "t1", studioId: "s1", targetType: "job", jobId: "job1", bookingId: "b1",
  customerId: "c1", amount: 100000, currency: "INR", method: "razorpay_payment_link", status: "completed",
  razorpayPaymentId: "rzp_pay_1", refundAmount: null,
};

beforeEach(() => {
  const f = fakeFirestore({
    bookings: { b1: { ...missedBooking } },
    jobs: { job1: { id: "job1", tenantId: "t1", studioId: "s1", bookingId: "b1", paymentStatus: "paid" } },
    payments: { pay1: { ...paidPayment } },
  });
  h.db = f.db; h.data = f.data;
  vi.clearAllMocks();
});

const req = (payload: unknown): any => ({ data: payload });

describe("no-show review", () => {
  it("records a contact note on the booking", async () => {
    const r: any = await recordNoShowContact.run(req({ bookingId: "b1", channel: "phone", note: "Called, customer forgot" }));
    expect(r.recorded).toBe(true);
    expect(h.data["bookings"]!["b1"]!["noShowContactLog"]).toHaveLength(1);
  });

  it("preview returns both delegated-policy candidates plus waiver, preselecting none", async () => {
    const r: any = await previewNoShowResolution.run(req({ bookingId: "b1" }));
    expect(r.capturedPaise).toBe(100000);
    expect(r.candidates).toEqual([
      { key: "flat_rs100", chargePaise: 10000, refundPaise: 90000 },
      { key: "pct_20", chargePaise: 20000, refundPaise: 80000 },
      { key: "waive", chargePaise: 0, refundPaise: 100000 },
    ]);
    expect(r).not.toHaveProperty("selected");
  });

  it("charge resolution reserves exactly captured-minus-charge in the outbox", async () => {
    const r: any = await resolveNoShow.run(req({ bookingId: "b1", resolution: "charge", chargePaise: 10000, reason: "policy charge" }));
    expect(r).toMatchObject({ resolved: true, chargePaise: 10000 });
    const rr = h.data["refundRequests"]![r.refundRequestId]!;
    expect(rr).toMatchObject({ amountPaise: 90000, status: "reserved", paymentId: "pay1" });
    expect(h.data["bookings"]!["b1"]).toMatchObject({ noShowResolution: "charge", cancellationFeeStatus: "withheld" });
  });

  it("waive reserves a full refund and marks the fee waived", async () => {
    const r: any = await resolveNoShow.run(req({ bookingId: "b1", resolution: "waive", reason: "regular customer" }));
    expect(h.data["refundRequests"]![r.refundRequestId]!["amountPaise"]).toBe(100000);
    expect(h.data["bookings"]!["b1"]!["cancellationFeeStatus"]).toBe("waived");
  });

  it("charge requires an explicit amount and never exceeds captured", async () => {
    await expect(resolveNoShow.run(req({ bookingId: "b1", resolution: "charge", reason: "x" }))).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(resolveNoShow.run(req({ bookingId: "b1", resolution: "charge", chargePaise: 100001, reason: "x" }))).rejects.toMatchObject({ code: "invalid-argument" });
    expect(h.data["refundRequests"]).toBeUndefined();
  });

  it("a resolved no-show cannot be resolved twice", async () => {
    await resolveNoShow.run(req({ bookingId: "b1", resolution: "waive", reason: "first" }));
    await expect(resolveNoShow.run(req({ bookingId: "b1", resolution: "waive", reason: "second" }))).rejects.toMatchObject({ code: "already-exists" });
    expect(Object.keys(h.data["refundRequests"] ?? {}).filter((k) => k.startsWith("rr_"))).toHaveLength(1);
  });

  it("reopen stays held rather than bypassing capacity checks", async () => {
    await expect(resolveNoShow.run(req({ bookingId: "b1", resolution: "reopen", reason: "customer returning" }))).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("a booking that was not a no-show is rejected", async () => {
    h.data["bookings"]!["b1"]!["status"] = "CONFIRMED";
    await expect(previewNoShowResolution.run(req({ bookingId: "b1" }))).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

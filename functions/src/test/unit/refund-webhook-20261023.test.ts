// Track A2: reserved refund.created handling + late-capture guard (fresh).
import { describe, it, expect, vi } from "vitest";

const audits: Array<{ action: string }> = [];
vi.mock("../../middleware/audit.js", () => ({ writeAuditLog: (_tx: unknown, p: { action: string }) => { audits.push(p); } }));

import { processProviderEvent } from "../../lib/razorpay-webhook.js";
import { reserveRefund } from "../../lib/refund-outbox.js";
import { fakeFirestore } from "./fake-firestore.js";
import type { Payment } from "@autodeck/core";
import type { ProviderWebhookEvent } from "../../lib/payment-provider.js";

const payment = (o: Record<string, unknown> = {}): Payment => ({
  id: "pay1", tenantId: "t1", studioId: "s1", targetType: "job", jobId: "job1", bookingId: "b1",
  membershipId: null, giftId: null, customerId: "c1", amount: 100000, currency: "INR",
  method: "razorpay_payment_link", status: "completed", razorpayPaymentLinkId: "pl1",
  razorpayPaymentId: "rzp_pay_1", razorpayOrderId: null, razorpayRefundId: null, refundAmount: null,
  manualReference: null, recordedBy: null, invoiceId: "inv1", providerEventId: null,
  completedAt: "2026-10-20T10:00:00.000Z", failedAt: null, cancelledAt: null, refundedAt: null,
  createdAt: "2026-10-20T09:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z", ...o,
});

const seed = (p: Payment) => ({
  payments: { [p.id]: p as unknown as Record<string, unknown> },
  jobs: { job1: { id: "job1", paymentStatus: "paid" } },
  bookings: { b1: { id: "b1", paymentStatus: "paid" } },
  invoices: { inv1: { id: "inv1", status: "issued" } },
});

const event = (o: Partial<ProviderWebhookEvent>): ProviderWebhookEvent => ({
  eventType: "refund.created", providerEventId: `evt_${Math.random().toString(36).slice(2)}`,
  providerPaymentId: "rzp_pay_1", providerPaymentLinkId: "pl1", providerRefundId: "rfnd_x",
  referenceId: "pay1", amount: 80000, currency: "INR", ...o,
});

describe("reserved refund.created", () => {
  it("records acceptance on the reservation only — payment, job, booking and invoice untouched", async () => {
    audits.length = 0;
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 80000, reason: "no-show", createdBy: "admin1" });
    const r = await processProviderEvent(db, event({ providerRefundId: "mock_rfnd_" + requestId }));
    expect(r.outcome).toBe("refund_accepted");
    expect(data["refundRequests"]![requestId]).toMatchObject({ status: "accepted", projectionNeeded: true });
    expect(data["payments"]!["pay1"]!["status"]).toBe("completed");
    expect(data["jobs"]!["job1"]!["paymentStatus"]).toBe("paid");
    expect(data["bookings"]!["b1"]!["paymentStatus"]).toBe("paid");
    expect(data["invoices"]!["inv1"]!["status"]).toBe("issued");
    expect(audits.filter((a) => a.action === "payment.refunded")).toHaveLength(0);
  });

  it("rejects an acceptance whose amount does not match the reservation", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 80000, reason: "no-show", createdBy: "admin1" });
    const r = await processProviderEvent(db, event({ amount: 80001 }));
    expect(r.outcome).toBe("amount_mismatch");
    expect(data["refundRequests"]![requestId]!["status"]).toBe("reserved");
  });

  it("rejects an acceptance naming a different refund id than the submission", async () => {
    const p = payment();
    const { db, data } = fakeFirestore(seed(p));
    const { requestId } = await reserveRefund(db, { payment: p, amountPaise: 80000, reason: "no-show", createdBy: "admin1" });
    data["refundRequests"]![requestId]!["status"] = "submitted";
    data["refundRequests"]![requestId]!["providerRefundId"] = "mock_rfnd_" + requestId;
    const r = await processProviderEvent(db, event({ providerRefundId: "rfnd_someone_else" }));
    expect(r.outcome).toBe("amount_mismatch");
    expect(data["refundRequests"]![requestId]!["status"]).toBe("submitted");
  });
});

describe("late capture guard", () => {
  it("a capture event on a partially refunded payment changes nothing", async () => {
    const p = payment({ status: "partially_refunded", refundAmount: 20000 });
    const { db, data } = fakeFirestore(seed(p));
    const r = await processProviderEvent(db, event({ eventType: "payment.captured", amount: 100000 }));
    expect(r.outcome).toBe("already_final");
    expect(data["payments"]!["pay1"]).toMatchObject({ status: "partially_refunded", refundAmount: 20000 });
  });
});

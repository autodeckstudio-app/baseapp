/**
 * Emulator integration tests for confirmManualPayment (Phase 3G — P0 #1).
 *
 * Proves the production cash-payment flow that confirmPaymentMock cannot
 * cover in production (it's dev/emulator-gated): customer initiates a cash
 * payment → studio/admin confirms the EXISTING pending payment → payment
 * completes, invoice issues, job/booking sync, audit trail, idempotency,
 * and every rejection path (wrong role/studio/tenant/status/method).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, Payment, Invoice, AuditLog } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createBooking } from "../../functions/booking/createBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { confirmManualPayment } from "../../functions/payment/confirmManualPayment.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
import { initiateRefund } from "../../functions/payment/initiateRefund.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";

const db = getFirestore();

const TENANT_A = "pc-tenant-a";
const TENANT_B = "pc-tenant-b";
const STUDIO_A = "pc-studio-a";
const STUDIO_B = "pc-studio-b";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

let dayOffset = 3;
function nextDate(): string {
  dayOffset += 1;
  return new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
}

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null }, rawToken: "test" };
}
function studioAuth(authUid: string, studioId: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId }, rawToken: "test" };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null }, rawToken: "test" };
}

async function seedStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Payment Confirm Test Studio",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    operatingHours: [],
    holidays: [],
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30,
    maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: Array.from({ length: 5 }, (_, i) => ({
      id: `${studioId}-wash-${i + 1}`,
      tenantId,
      studioId,
      name: `Wash Bay ${i + 1}`,
      bayType: "wash" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
}

async function seedService(serviceId: string, tenantId: string) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Payment Confirm Test Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice: 40000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType: "wash",
    membershipWashEligible: false,
    active: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

async function seedVehicle(vehicleId: string, tenantId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber: "GJ01PC" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Maruti",
    model: "Swift",
    year: 2022,
    color: "White",
    category: "hatchback",
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("vehicles").doc(vehicleId).set(vehicle);
  return vehicle;
}

async function makeBookingAndJob(
  customerId: string,
  service: Service,
  vehicle: Vehicle,
  studioId: string,
  tenantId = TENANT_A,
): Promise<{ booking: Booking; job: ServiceJob }> {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "hatchback",
      studioId,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerId, tenantId),
  } as never)) as { booking: Booking };

  const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", result.booking.id).get();
  const job = jobsSnap.docs[0]?.data() as ServiceJob;
  return { booking: result.booking, job };
}

describe("confirmManualPayment — production cash payment completion", () => {
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_A, TENANT_A);
    await seedStudio(STUDIO_B, TENANT_A);
    await seedStudio("pc-studio-tenant-b", TENANT_B);
    service = await seedService(uid("svc-wash"), TENANT_A);
    customerId = uid("cust");
    vehicle = await seedVehicle(uid("veh"), TENANT_A, customerId);
  });

  it("A-E: customer initiates cash payment, studio confirms, payment completes, invoice issues, job/booking sync", async () => {
    const { booking, job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);

    // A: customer initiates cash payment
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    // B: studio sees pending payment
    const pendingSnap = await db.collection(COLLECTIONS.payments()).doc(initResult.paymentId).get();
    expect((pendingSnap.data() as Payment).status).toBe("pending");

    // C: studio confirms cash
    const studioUid = uid("studio-user");
    const confirmResult = (await confirmManualPayment.run({
      data: { paymentId: initResult.paymentId },
      auth: studioAuth(studioUid, STUDIO_A),
    } as never)) as { paymentId: string; invoiceId: string; alreadyCompleted: boolean };

    expect(confirmResult.alreadyCompleted).toBe(false);
    expect(confirmResult.invoiceId).toBeTruthy();

    // D: payment becomes completed
    const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(initResult.paymentId).get();
    const payment = paymentSnap.data() as Payment;
    expect(payment.status).toBe("completed");
    expect(payment.invoiceId).toBe(confirmResult.invoiceId);

    // E: invoice created correctly, linked to payment/job
    const invoiceSnap = await db.collection(COLLECTIONS.invoices()).doc(confirmResult.invoiceId).get();
    const invoice = invoiceSnap.data() as Invoice;
    expect(invoice.status).toBe("issued");
    expect(invoice.jobId).toBe(job.id);
    expect(invoice.paymentId).toBe(initResult.paymentId);
    expect(invoice.total).toBe(payment.amount);

    // Job + booking paymentStatus synced (F/G live-sync is the same
    // onSnapshot mechanism proven elsewhere in the suite; here we assert the
    // underlying documents both apps' listeners read are correct).
    const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(job.id).get();
    expect((jobSnap.data() as ServiceJob).paymentStatus).toBe("paid");
    const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(booking.id).get();
    expect((bookingSnap.data() as Booking).paymentStatus).toBe("paid");

    // O: audit events exist
    const auditSnap = await db
      .collection(COLLECTIONS.auditLog())
      .where("tenantId", "==", TENANT_A)
      .where("entityType", "==", "Payment")
      .where("entityId", "==", initResult.paymentId)
      .get();
    expect(auditSnap.docs.some((d) => (d.data() as AuditLog).action === "payment.completed")).toBe(true);
    const invoiceAuditSnap = await db
      .collection(COLLECTIONS.auditLog())
      .where("tenantId", "==", TENANT_A)
      .where("entityType", "==", "Invoice")
      .where("entityId", "==", confirmResult.invoiceId)
      .get();
    expect(invoiceAuditSnap.docs.some((d) => (d.data() as AuditLog).action === "invoice.issued")).toBe(true);
  });

  it("H: duplicate confirmation is idempotent — no duplicate invoice, amount unchanged", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    const first = (await confirmManualPayment.run({
      data: { paymentId: initResult.paymentId },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never)) as { paymentId: string; invoiceId: string; alreadyCompleted: boolean };

    const second = (await confirmManualPayment.run({
      data: { paymentId: initResult.paymentId },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never)) as { paymentId: string; invoiceId: string; alreadyCompleted: boolean };

    expect(second.alreadyCompleted).toBe(true);
    expect(second.invoiceId).toBe(first.invoiceId);

    const invoicesSnap = await db.collection(COLLECTIONS.invoices()).where("jobId", "==", job.id).get();
    expect(invoicesSnap.size).toBe(1); // no duplicate invoice created

    const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(initResult.paymentId).get();
    expect((paymentSnap.data() as Payment).amount).toBe(job.totalAmount); // M: amount unchanged
  });

  it("I: customer cannot confirm their own payment", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    await expect(
      confirmManualPayment.run({
        data: { paymentId: initResult.paymentId },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/Studio or admin role required/);
  });

  it("J: studio from a different studio (same tenant) cannot confirm", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    await expect(
      confirmManualPayment.run({
        data: { paymentId: initResult.paymentId },
        auth: studioAuth(uid("studio-b-user"), STUDIO_B),
      } as never),
    ).rejects.toThrow(/different studio/);
  });

  it("K: staff from a different tenant cannot confirm", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    await expect(
      confirmManualPayment.run({
        data: { paymentId: initResult.paymentId },
        auth: adminAuth(uid("tenant-b-admin"), TENANT_B),
      } as never),
    ).rejects.toThrow(/Cross-tenant/);
  });

  it("L: cannot confirm a payment that is already failed/refunded", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    await db.collection(COLLECTIONS.payments()).doc(initResult.paymentId).update({ status: "failed", failedAt: new Date().toISOString() });

    await expect(
      confirmManualPayment.run({
        data: { paymentId: initResult.paymentId },
        auth: studioAuth(uid("studio-user"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/Cannot confirm a payment in status 'failed'/);
  });

  it("cannot confirm an online (razorpay_payment_link) payment manually — no fake Razorpay completion path", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    // Seeded directly (bypassing initiatePayment's provider call, which is
    // unrelated to what this test verifies) — a pending online payment
    // record, exactly the shape initiatePayment would produce.
    const paymentId = uid("payment-razorpay");
    const now = new Date().toISOString();
    await db.collection(COLLECTIONS.payments()).doc(paymentId).set({
      id: paymentId,
      tenantId: TENANT_A,
      studioId: STUDIO_A,
      targetType: "job",
      jobId: job.id,
      bookingId: job.bookingId,
      membershipId: null,
      customerId,
      amount: job.totalAmount,
      currency: "INR",
      method: "razorpay_payment_link",
      status: "pending",
      razorpayPaymentLinkId: "plink_test",
      razorpayPaymentId: null,
      razorpayOrderId: "order_test",
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: null,
      recordedBy: null,
      invoiceId: null,
      providerEventId: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      confirmManualPayment.run({
        data: { paymentId },
        auth: studioAuth(uid("studio-user"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/Online payments cannot be confirmed manually/);
  });

  it("P: existing studio-initiated recordManualPayment flow is unaffected", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const result = (await recordManualPayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never)) as { paymentId: string; invoiceId: string };

    const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(result.paymentId).get();
    expect((paymentSnap.data() as Payment).status).toBe("completed");
  });

  it("admin can also confirm (tenant-wide role parity with studio)", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never)) as { paymentId: string };

    const result = (await confirmManualPayment.run({
      data: { paymentId: initResult.paymentId },
      auth: adminAuth(uid("admin-user")),
    } as never)) as { alreadyCompleted: boolean };
    expect(result.alreadyCompleted).toBe(false);
  });

  // ─── Phase 6 hostile-audit regression tests ──────────────────────────────
  // Found by adversarial re-audit: confirmManualPayment/recordManualPayment
  // never checked whether ANOTHER payment already existed for the same job
  // (only checked the job's own paymentStatus, which initiatePayment never
  // sets — it stays "unpaid" for a payment's entire pending window), and
  // neither cancelBooking nor confirmManualPayment checked whether the job
  // had already been cancelled out from under an in-flight payment.

  // Each test below uses a FRESH customer+vehicle (not the shared
  // beforeAll customer) — this describe block already runs ~16 createBooking
  // calls against one customerId, and booking.create is rate-limited to
  // 10/60s; reusing it here would exceed that budget and fail with an
  // unrelated "Too many attempts" error.
  async function freshCustomerAndVehicle(): Promise<{ customerId: string; vehicle: Vehicle }> {
    const freshCustomerId = uid("cust-q");
    const freshVehicle = await seedVehicle(uid("veh-q"), TENANT_A, freshCustomerId);
    return { customerId: freshCustomerId, vehicle: freshVehicle };
  }

  it("Q: recordManualPayment cannot create a second payment while a customer-initiated one is already pending", async () => {
    const { customerId: freshCustomerId, vehicle: freshVehicle } = await freshCustomerAndVehicle();
    const { job } = await makeBookingAndJob(freshCustomerId, service, freshVehicle, STUDIO_A);

    // Customer initiates a "pay at studio" payment — still pending.
    await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(freshCustomerId),
    } as never);

    // job.paymentStatus is still "unpaid" at this point — recordManualPayment
    // must not be fooled by that into creating a second payment.
    await expect(
      recordManualPayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: studioAuth(uid("studio-user"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/A payment already exists/);

    const paymentsSnap = await db.collection(COLLECTIONS.payments()).where("jobId", "==", job.id).get();
    expect(paymentsSnap.docs).toHaveLength(1);
  });

  it("R: confirmManualPayment cannot complete a payment for a job that a DIFFERENT payment already completed", async () => {
    const { customerId: freshCustomerId, vehicle: freshVehicle } = await freshCustomerAndVehicle();
    const { job } = await makeBookingAndJob(freshCustomerId, service, freshVehicle, STUDIO_A);

    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(freshCustomerId),
    } as never)) as { paymentId: string };

    // Studio directly records a cash payment instead of confirming the
    // pending one (a real UI-reachable path: admin's job detail page shows
    // both actions without one disabling the other). This is now blocked by
    // Q's fix, but simulate the state directly to prove confirmManualPayment
    // itself also refuses to complete once the job is already paid,
    // independent of the recordManualPayment-level guard (defense in depth).
    await db.collection(COLLECTIONS.jobs()).doc(job.id).update({ paymentStatus: "paid" });

    await expect(
      confirmManualPayment.run({
        data: { paymentId: initResult.paymentId },
        auth: studioAuth(uid("studio-user-2"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/already been marked as paid/);
  });

  it("S: cancelBooking is rejected once a payment has been initiated for its job", async () => {
    const { customerId: freshCustomerId, vehicle: freshVehicle } = await freshCustomerAndVehicle();
    const { booking, job } = await makeBookingAndJob(freshCustomerId, service, freshVehicle, STUDIO_A);

    await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(freshCustomerId),
    } as never);

    await expect(
      cancelBooking.run({
        data: { bookingId: booking.id, reason: "test cancellation attempt" },
        auth: customerAuth(freshCustomerId),
      } as never),
    ).rejects.toThrow(/Cannot cancel a booking once payment/);

    const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(booking.id).get();
    expect((bookingSnap.data() as Booking).status).toBe("CONFIRMED");
  });

  it("T: confirmManualPayment cannot complete payment for an already-cancelled job", async () => {
    const { customerId: freshCustomerId, vehicle: freshVehicle } = await freshCustomerAndVehicle();
    const { booking, job } = await makeBookingAndJob(freshCustomerId, service, freshVehicle, STUDIO_A);

    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(freshCustomerId),
    } as never)) as { paymentId: string };

    // Cancel the job/booking directly (bypassing cancelBooking's now-fixed
    // in-flight-payment guard) to prove confirmManualPayment itself also
    // refuses a cancelled job, independent of that guard — defense in depth,
    // matching recordManualPayment's existing job.status check.
    await db.collection(COLLECTIONS.jobs()).doc(job.id).update({ status: "CANCELLED" });
    await db.collection(COLLECTIONS.bookings()).doc(booking.id).update({ status: "CANCELLED" });

    await expect(
      confirmManualPayment.run({
        data: { paymentId: initResult.paymentId },
        auth: studioAuth(uid("studio-user-3"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/Cannot confirm payment for a cancelled job/);
  });
});

// ─── initiateRefund — Phase 5B P0-2: in-transaction re-check + deterministic
// idempotency key, so two concurrent refund calls on one payment can never
// both issue a real provider refund. ────────────────────────────────────────

describe("initiateRefund — race safety and idempotency", () => {
  const REFUND_STUDIO = "pc-refund-studio";
  const REFUND_TENANT = "pc-refund-tenant";

  beforeAll(async () => {
    await seedStudio(REFUND_STUDIO, REFUND_TENANT);
  });

  async function seedCompletedRazorpayPayment(paymentId: string): Promise<Payment> {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: paymentId,
      tenantId: REFUND_TENANT,
      studioId: REFUND_STUDIO,
      targetType: "job",
      jobId: null,
      bookingId: null,
      membershipId: null,
      customerId: uid("cust"),
      amount: 47200,
      currency: "INR",
      method: "razorpay_payment_link",
      status: "completed",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: "rzp_pay_test_123",
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: null,
      recordedBy: null,
      invoiceId: null,
      providerEventId: null,
      completedAt: now,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.payments()).doc(paymentId).set(payment);
    return payment;
  }

  it("re-reads payment status inside the transaction: two concurrent refund calls on one payment — exactly one succeeds, provider is called exactly once (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) —
    // deterministic once fixed (the refund claim doc is read+written inside
    // one transaction), but the loop guards against a future regression
    // with far higher confidence than one pair. Each iteration uses its own
    // fresh payment so iterations never interfere with each other.
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const paymentId = uid("pay-refund-race");
      await seedCompletedRazorpayPayment(paymentId);

      const spy = vi.spyOn(getPaymentProvider(), "initiateRefund");
      const before = spy.mock.calls.length;

      const [r1, r2] = await Promise.allSettled([
        initiateRefund.run({
          data: { paymentId, reason: "race test A" },
          auth: adminAuth(uid("admin-a"), REFUND_TENANT),
        } as never),
        initiateRefund.run({
          data: { paymentId, reason: "race test B" },
          auth: adminAuth(uid("admin-b"), REFUND_TENANT),
        } as never),
      ]);

      const results = [r1, r2];
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled, `iteration ${i}`).toHaveLength(1);
      expect(rejected, `iteration ${i}`).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message, `iteration ${i}`).toMatch(
        /already been initiated|already-exists|status 'refunded'/,
      );

      // The defect this test reproduces: without the in-transaction
      // re-check and deterministic idempotency key, BOTH calls would call
      // the real provider (two live refunds for one payment). Assert it
      // was called exactly once.
      expect(spy.mock.calls.length - before, `iteration ${i}`).toBe(1);

      const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
      const payment = paymentSnap.data() as Payment;
      expect(payment.status, `iteration ${i}`).toBe("refunded");
      // Deterministic referenceId (no Date.now()) — proven by asserting the
      // exact expected id rather than just "some string".
      expect(payment.razorpayRefundId, `iteration ${i}`).toBe(`mock_rfnd_refund_${paymentId}`);

      const auditSnap = await db
        .collection(COLLECTIONS.auditLog())
        .where("tenantId", "==", REFUND_TENANT)
        .where("entityType", "==", "Payment")
        .where("entityId", "==", paymentId)
        .where("action", "==", "payment.refunded")
        .get();
      expect(auditSnap.docs, `iteration ${i}`).toHaveLength(1);

      spy.mockRestore();
    }
  }, 180_000);

  it("happy path: a single refund call still completes correctly (transaction refactor preserves behavior)", async () => {
    const paymentId = uid("pay-refund-happy");
    await seedCompletedRazorpayPayment(paymentId);

    const result = (await initiateRefund.run({
      data: { paymentId, reason: "customer requested" },
      auth: adminAuth(uid("admin-happy"), REFUND_TENANT),
    } as never)) as { paymentId: string; refunded: boolean; providerRefundId: string | null };

    expect(result.refunded).toBe(true);
    expect(result.providerRefundId).toBe(`mock_rfnd_refund_${paymentId}`);

    const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
    const payment = paymentSnap.data() as Payment;
    expect(payment.status).toBe("refunded");
    expect(payment.refundAmount).toBe(payment.amount);
    expect(payment.refundedAt).toBeTruthy();
  });

  it("rejects refunding a payment that is not completed", async () => {
    const paymentId = uid("pay-refund-notcompleted");
    await seedCompletedRazorpayPayment(paymentId);
    await db.collection(COLLECTIONS.payments()).doc(paymentId).update({ status: "pending" });

    await expect(
      initiateRefund.run({
        data: { paymentId, reason: "should fail" },
        auth: adminAuth(uid("admin-reject"), REFUND_TENANT),
      } as never),
    ).rejects.toThrow(/Can only refund completed payments/);
  });

  it("rejects refunding an already-refunded payment (sequential retry)", async () => {
    const paymentId = uid("pay-refund-twice");
    await seedCompletedRazorpayPayment(paymentId);

    await initiateRefund.run({
      data: { paymentId, reason: "first refund" },
      auth: adminAuth(uid("admin-first"), REFUND_TENANT),
    } as never);

    // The first call already flipped payment.status to "refunded" — a
    // sequential (non-concurrent) second call is caught by the cheap
    // fast-fail pre-check before it ever reaches the in-transaction claim
    // logic (that logic's own message, "already been initiated"/"status
    // 'refunded'", is what a genuinely concurrent second call sees instead
    // — see the race test above).
    await expect(
      initiateRefund.run({
        data: { paymentId, reason: "second refund attempt" },
        auth: adminAuth(uid("admin-second"), REFUND_TENANT),
      } as never),
    ).rejects.toThrow(/Can only refund completed payments/);
  });

  it("releases the claim on provider failure so a genuine retry can succeed", async () => {
    const paymentId = uid("pay-refund-retry");
    await seedCompletedRazorpayPayment(paymentId);

    const spy = vi.spyOn(getPaymentProvider(), "initiateRefund").mockRejectedValueOnce(new Error("provider down"));

    await expect(
      initiateRefund.run({
        data: { paymentId, reason: "will fail" },
        auth: adminAuth(uid("admin-fail"), REFUND_TENANT),
      } as never),
    ).rejects.toThrow(/provider down/);

    // Payment must still be "completed" — the failed attempt must not have
    // left it stuck in a half-refunded state.
    const midSnap = await db.collection(COLLECTIONS.payments()).doc(paymentId).get();
    expect((midSnap.data() as Payment).status).toBe("completed");

    spy.mockRestore();

    // Retry succeeds now that the claim was released.
    const retryResult = (await initiateRefund.run({
      data: { paymentId, reason: "retry after provider recovers" },
      auth: adminAuth(uid("admin-retry"), REFUND_TENANT),
    } as never)) as { refunded: boolean };
    expect(retryResult.refunded).toBe(true);
  });
});

// ─── initiatePayment — Phase 5B P1-7: in-transaction re-check so two
// concurrent initiatePayment calls for the same job can never both create a
// separate Payment. ─────────────────────────────────────────────────────────

describe("initiatePayment — race safety", () => {
  const IP_STUDIO = "pc-ip-studio";
  const IP_TENANT = "pc-ip-tenant";
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;

  beforeAll(async () => {
    await seedStudio(IP_STUDIO, IP_TENANT);
    service = await seedService(uid("svc-ip"), IP_TENANT);
    customerId = uid("cust-ip");
    vehicle = await seedVehicle(uid("veh-ip"), IP_TENANT, customerId);
  });

  it("two concurrent initiatePayment calls for the same job result in exactly one payment (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) —
    // deterministic once fixed (the claim transaction re-checks via
    // tx.get()), but the loop guards against a future regression with far
    // higher confidence than one pair. Each iteration uses its own fresh
    // customer/vehicle/studio/job: a fresh customer avoids tripping
    // payment.initiate's 10/min rate limit across the 40 rapid calls this
    // loop makes from one uid, and a fresh single-purpose studio lets every
    // iteration safely reuse the SAME booking date instead of calling
    // nextDate() per iteration (which draws from this file's shared,
    // monotonic, 30-day-bounded counter and would exhaust it for other
    // tests in this file).
    const raceDate = nextDate();
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const raceStudioId = uid("ip-race-studio");
      await seedStudio(raceStudioId, IP_TENANT);
      const raceCustomerId = uid("ip-race-cust");
      const raceVehicle = await seedVehicle(uid("ip-race-veh"), IP_TENANT, raceCustomerId);
      const bookingResult = (await createBooking.run({
        data: {
          serviceId: service.id,
          vehicleId: raceVehicle.id,
          vehicleCategory: "hatchback",
          studioId: raceStudioId,
          scheduledDate: raceDate,
          scheduledTime: "10:00",
          idempotencyKey: uid("idem"),
        },
        auth: customerAuth(raceCustomerId, IP_TENANT),
      } as never)) as { booking: Booking };
      const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", bookingResult.booking.id).get();
      const job = jobsSnap.docs[0]?.data() as ServiceJob;

      // The defect this test reproduces: the duplicate-payment check
      // previously ran as a plain query outside any transaction and was
      // never re-verified before the write — two concurrent calls could
      // both observe "no existing payment" and each create a separate
      // Payment doc for one job (double payment link / duplicate invoice
      // risk).
      const [r1, r2] = (await Promise.all([
        initiatePayment.run({
          data: { jobId: job.id, method: "cash" },
          auth: customerAuth(raceCustomerId, IP_TENANT),
        } as never),
        initiatePayment.run({
          data: { jobId: job.id, method: "cash" },
          auth: customerAuth(raceCustomerId, IP_TENANT),
        } as never),
      ])) as [{ paymentId: string }, { paymentId: string }];

      expect(r1.paymentId, `iteration ${i}`).toBe(r2.paymentId);

      const paymentsSnap = await db
        .collection(COLLECTIONS.payments())
        .where("jobId", "==", job.id)
        .where("status", "in", ["pending", "processing", "completed"])
        .get();
      expect(paymentsSnap.docs, `iteration ${i}`).toHaveLength(1);
    }
  }, 180_000);

  it("razorpay_payment_link payments still work unchanged outside production (Phase 5B P1-10 regression)", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, IP_STUDIO, IP_TENANT);

    const result = (await initiatePayment.run({
      data: { jobId: job.id, method: "razorpay_payment_link" },
      auth: customerAuth(customerId, IP_TENANT),
    } as never)) as { paymentId: string; paymentUrl: string | null; status: string };

    expect(result.status).toBe("pending");
    expect(result.paymentUrl).toBeTruthy();

    const paymentSnap = await db.collection(COLLECTIONS.payments()).doc(result.paymentId).get();
    expect((paymentSnap.data() as Payment).razorpayPaymentLinkId).toBeTruthy();
  });
});

// ─── confirmPaymentMock — Phase 5B P1-8: terminal-state guard matching
// confirmManualPayment.ts, so a duplicate payment reaching this success path
// twice can never issue two invoices for one job. ──────────────────────────

describe("confirmPaymentMock — terminal-state safety", () => {
  const CM_STUDIO = "pc-cm-studio";
  const CM_TENANT = "pc-cm-tenant";
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;

  beforeAll(async () => {
    await seedStudio(CM_STUDIO, CM_TENANT);
    service = await seedService(uid("svc-cm"), CM_TENANT);
    customerId = uid("cust-cm");
    vehicle = await seedVehicle(uid("veh-cm"), CM_TENANT, customerId);
  });

  async function seedPendingPayment(paymentId: string, jobId: string, amount: number): Promise<void> {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: paymentId,
      tenantId: CM_TENANT,
      studioId: CM_STUDIO,
      targetType: "job",
      jobId,
      bookingId: null,
      membershipId: null,
      customerId,
      amount,
      currency: "INR",
      method: "cash",
      status: "pending",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: null,
      recordedBy: null,
      invoiceId: null,
      providerEventId: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.payments()).doc(paymentId).set(payment);
  }

  it("a second duplicate payment for an already-paid job is rejected instead of issuing a second invoice", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, CM_STUDIO, CM_TENANT);

    // Two independent pending payments for the same job, seeded directly to
    // isolate this test from initiatePayment's own dedupe fix (P1-7) — this
    // reproduces the state a duplicate could reach by any other path (e.g.
    // recordManualPayment racing initiatePayment before those functions'
    // own guards existed, or a future webhook handler built on this file's
    // shape).
    const payment1Id = uid("pay-cm-1");
    const payment2Id = uid("pay-cm-2");
    await seedPendingPayment(payment1Id, job.id, job.totalAmount);
    await seedPendingPayment(payment2Id, job.id, job.totalAmount);

    const first = (await confirmPaymentMock.run({
      data: { paymentId: payment1Id, mockResult: "success" },
      auth: studioAuth(uid("studio-cm-1"), CM_STUDIO, CM_TENANT),
    } as never)) as { idempotent: boolean };
    expect(first.idempotent).toBe(false);

    await expect(
      confirmPaymentMock.run({
        data: { paymentId: payment2Id, mockResult: "success" },
        auth: studioAuth(uid("studio-cm-2"), CM_STUDIO, CM_TENANT),
      } as never),
    ).rejects.toThrow(/already been marked as paid/);

    const invoicesSnap = await db.collection(COLLECTIONS.invoices()).where("jobId", "==", job.id).get();
    expect(invoicesSnap.docs).toHaveLength(1);
  });

  it("rejects confirming a payment for an already-cancelled job", async () => {
    const { job } = await makeBookingAndJob(customerId, service, vehicle, CM_STUDIO, CM_TENANT);
    await db.collection(COLLECTIONS.jobs()).doc(job.id).update({ status: "CANCELLED" });

    const paymentId = uid("pay-cm-cancelled");
    await seedPendingPayment(paymentId, job.id, job.totalAmount);

    await expect(
      confirmPaymentMock.run({
        data: { paymentId, mockResult: "success" },
        auth: studioAuth(uid("studio-cm-3"), CM_STUDIO, CM_TENANT),
      } as never),
    ).rejects.toThrow(/Cannot confirm payment for a cancelled job/);
  });
});

// ─── Cross-studio authorization — Phase 5B P1-14 ────────────────────────────
// STUDIO_A and STUDIO_B are both seeded in TENANT_A by the very first
// describe block's beforeAll above (which runs first in this file), so they
// are already available here.

describe("Cross-studio authorization (Phase 5B P1-14)", () => {
  let csService: Service;
  let csVehicle: Vehicle;
  let csCustomerId: string;

  beforeAll(async () => {
    csService = await seedService(uid("svc-cs"), TENANT_A);
    csCustomerId = uid("cust-cs");
    csVehicle = await seedVehicle(uid("veh-cs"), TENANT_A, csCustomerId);
  });

  it("initiatePayment: a Studio B employee cannot initiate payment for a Studio A job", async () => {
    const { job } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    await expect(
      initiatePayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: studioAuth(uid("studio-b-user"), STUDIO_B),
      } as never),
    ).rejects.toThrow(/different studio/);
  });

  it("initiatePayment: admin (not studio-scoped) CAN initiate payment across studios — admin access is not weakened", async () => {
    const { job } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    const result = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: adminAuth(uid("admin-cross-studio")),
    } as never)) as { paymentId: string };
    expect(result.paymentId).toBeTruthy();
  });

  it("recordManualPayment: a Studio B employee cannot record a cash payment for a Studio A job", async () => {
    const { job } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    await expect(
      recordManualPayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: studioAuth(uid("studio-b-user-2"), STUDIO_B),
      } as never),
    ).rejects.toThrow(/different studio/);
  });

  it("confirmPaymentMock: a Studio B employee cannot confirm a payment belonging to a Studio A job", async () => {
    const { job } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);
    const initResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(csCustomerId),
    } as never)) as { paymentId: string };

    await expect(
      confirmPaymentMock.run({
        data: { paymentId: initResult.paymentId, mockResult: "success" },
        auth: studioAuth(uid("studio-b-user-3"), STUDIO_B),
      } as never),
    ).rejects.toThrow(/different studio/);
  });

  it("cancelBooking: a Studio B employee cannot cancel a Studio A booking", async () => {
    const { booking } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    await expect(
      cancelBooking.run({
        data: { bookingId: booking.id, reason: "cross-studio attempt" },
        auth: studioAuth(uid("studio-b-user-4"), STUDIO_B),
      } as never),
    ).rejects.toThrow(/different studio/);

    const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(booking.id).get();
    expect((bookingSnap.data() as Booking).status).not.toBe("CANCELLED");
  });

  it("cancelBooking: admin (not studio-scoped) CAN cancel across studios — admin access is not weakened", async () => {
    const { booking } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    const result = (await cancelBooking.run({
      data: { bookingId: booking.id, reason: "admin cancels cross-studio" },
      auth: adminAuth(uid("admin-cross-studio-2")),
    } as never)) as { success: boolean };
    expect(result.success).toBe(true);
  });

  it("rescheduleBooking: a Studio B employee cannot reschedule a Studio A booking", async () => {
    const { booking } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    await expect(
      rescheduleBooking.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "12:00", idempotencyKey: uid("idem") },
        auth: studioAuth(uid("studio-b-user-5"), STUDIO_B),
      } as never),
    ).rejects.toThrow(/different studio/);

    const bookingSnap = await db.collection(COLLECTIONS.bookings()).doc(booking.id).get();
    expect((bookingSnap.data() as Booking).rescheduleCount).toBe(0);
  });

  it("a Studio A employee (own studio) CAN act on a Studio A job/booking — the fix doesn't over-restrict", async () => {
    const { job, booking } = await makeBookingAndJob(csCustomerId, csService, csVehicle, STUDIO_A);

    const paymentResult = (await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: studioAuth(uid("studio-a-user"), STUDIO_A),
    } as never)) as { paymentId: string };
    expect(paymentResult.paymentId).toBeTruthy();

    const rescheduleResult = (await rescheduleBooking.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "15:00", idempotencyKey: uid("idem") },
      auth: studioAuth(uid("studio-a-user-2"), STUDIO_A),
    } as never)) as { booking: Booking };
    expect(rescheduleResult.booking.scheduledTime).toBe("15:00");
  });
});

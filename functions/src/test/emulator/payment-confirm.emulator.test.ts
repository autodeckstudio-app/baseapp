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
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, Payment, Invoice, AuditLog } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createBooking } from "../../functions/booking/createBooking.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { confirmManualPayment } from "../../functions/payment/confirmManualPayment.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";

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
});

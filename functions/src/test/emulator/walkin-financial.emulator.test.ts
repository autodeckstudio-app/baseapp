/**
 * Emulator integration tests for the walk-in financial flow.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080 —
 * see src/test/emulator-setup.ts, which points the Admin SDK at it).
 *
 * These invoke the REAL exported Cloud Function handlers in-process via the
 * `.run({ data, auth })` entry point that firebase-functions v2 attaches to
 * every onCall export — no separate Functions emulator process is needed,
 * and no Firebase Auth tokens are required since we construct the
 * CallableRequest.auth object directly (the same shape `extractUser()` reads
 * from a real verified ID token).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, ServiceJob, Payment, Invoice, Customer } from "@autodeck/core";

// confirmPaymentMock is gated to dev/emulator environments — this flag is
// normally set by the real Functions emulator runtime; set it directly since
// these tests invoke the handler in-process rather than through that runtime.
process.env["USE_PAYMENT_MOCK"] = "true";

import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { initiatePayment } from "../../functions/payment/initiatePayment.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";
import { recordManualPayment } from "../../functions/payment/recordManualPayment.js";
import { updateService } from "../../functions/service/updateService.js";

const db = getFirestore();

const TENANT_A = "walkin-fin-tenant-a";
const TENANT_B = "walkin-fin-tenant-b";
const STUDIO_ID = "walkin-fin-studio";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null } };
}
function studioAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId: STUDIO_ID } };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null } };
}

// Seed many bays so each createWalkinJob call in this file can use a fresh,
// never-before-occupied bay — a shared single bay would trip the real
// bay-occupancy conflict check (jobs stay "occupied" until DELIVERED/
// CANCELLED, and these tests don't advance job status).
// Phase 5B P2-4: bumped from 30 to accommodate test 7b's 20-iteration
// concurrency stress loop (each iteration consumes one fresh bay).
const BAY_COUNT = 55;

async function seedStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Walk-in Financial Test Studio",
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
    bays: Array.from({ length: BAY_COUNT }, (_, i) => ({
      id: `${studioId}-bay-${i + 1}`,
      tenantId,
      studioId,
      name: `Wash Bay ${i + 1}`,
      bayType: "wash" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

let bayCounter = 0;
function nextBay(): string {
  bayCounter += 1;
  if (bayCounter > BAY_COUNT) throw new Error("Test exhausted seeded bays — increase BAY_COUNT.");
  return `${STUDIO_ID}-bay-${bayCounter}`;
}

async function seedService(serviceId: string, tenantId: string, basePrice: number) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Walk-in Test Wash",
    category: "washing",
    brand: null,
    description: "Test wash",
    basePrice,
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
    registrationNumber: "GJ01WF" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
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

async function seedCustomer(customerId: string, tenantId: string) {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: customerId,
    tenantId,
    authUid: customerId,
    name: "Walk-in Test Customer",
    phone: "+919876500000",
    notificationPrefs: { push: true, quietMode: false },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("customers").doc(customerId).set(customer);
  return customer;
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

describe("Walk-in financial flow", () => {
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;
  let studioUid: string;
  let adminUid: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT_A);
    service = await seedService(uid("svc"), TENANT_A, 40000);
    customerId = uid("cust");
    await seedCustomer(customerId, TENANT_A);
    vehicle = await seedVehicle(uid("veh"), TENANT_A, customerId);
    studioUid = uid("studio-user");
    adminUid = uid("admin-user");
  });

  it("1. walk-in creation succeeds and produces a job with bookingId=null, isWalkIn=true", async () => {
    const result = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);

    expect(result.job.bookingId).toBeNull();
    expect(result.job.isWalkIn).toBe(true);
    expect(result.job.status).toBe("VEHICLE_RECEIVED");
  });

  it("2. walk-in price snapshot is server-computed via the shared pricing engine (basePrice + 18% GST)", async () => {
    const result = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);

    // basePrice=40000, no vehicleCategoryPricing rule for hatchback => scopeAdjustment=0
    // tax = round(40000 * 18 / 100) = 7200; total = 47200
    expect(result.job.priceBreakdown.basePrice).toBe(40000);
    expect(result.job.priceBreakdown.scopeAdjustment).toBe(0);
    expect(result.job.priceBreakdown.tax).toBe(7200);
    expect(result.job.priceBreakdown.total).toBe(47200);
    expect(result.job.totalAmount).toBe(47200);
  });

  it("3. walk-in payment: customer-initiated → studio-confirmed → invoice issued, referencing the job not a fabricated booking", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const initiated = await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never);
    expect(initiated.status).toBe("pending");

    const confirmed = await confirmPaymentMock.run({
      data: { paymentId: initiated.paymentId, mockResult: "success" },
      auth: studioAuth(studioUid),
    } as never);
    expect(confirmed.idempotent).toBe(false);

    const paymentSnap = await db.collection("payments").doc(initiated.paymentId).get();
    const payment = paymentSnap.data() as Payment;
    expect(payment.status).toBe("completed");
    expect(payment.jobId).toBe(job.id);
    expect(payment.bookingId).toBeNull(); // never fabricated
    expect(payment.invoiceId).not.toBeNull();

    const invoiceSnap = await db.collection("invoices").doc(payment.invoiceId as string).get();
    const invoice = invoiceSnap.data() as Invoice;
    expect(invoice.status).toBe("issued");
    expect(invoice.jobId).toBe(job.id);
    expect(invoice.bookingId).toBeNull();
    expect(invoice.total).toBe(job.priceBreakdown.total);
  });

  it("4. studio-recorded walk-in payment (no prior customer-initiated payment) issues payment + invoice directly", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const recorded = await recordManualPayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: studioAuth(studioUid),
    } as never);

    const paymentSnap = await db.collection("payments").doc(recorded.paymentId).get();
    const payment = paymentSnap.data() as Payment;
    expect(payment.status).toBe("completed");
    expect(payment.jobId).toBe(job.id);
    expect(payment.bookingId).toBeNull();

    const jobSnap = await db.collection("jobs").doc(job.id).get();
    expect((jobSnap.data() as ServiceJob).paymentStatus).toBe("paid");

    const invoiceSnap = await db.collection("invoices").doc(recorded.invoiceId).get();
    expect((invoiceSnap.data() as Invoice).status).toBe("issued");
  });

  it("5. failed walk-in payment marks the payment failed, not completed, and issues no invoice", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const initiated = await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never);

    const failed = await confirmPaymentMock.run({
      data: { paymentId: initiated.paymentId, mockResult: "failure" },
      auth: studioAuth(studioUid),
    } as never);
    expect(failed.idempotent).toBe(false);

    const paymentSnap = await db.collection("payments").doc(initiated.paymentId).get();
    const payment = paymentSnap.data() as Payment;
    expect(payment.status).toBe("failed");
    expect(payment.invoiceId).toBeNull();
  });

  it("6. walk-in invoice references its source job and carries no fabricated bookingId", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const recorded = await recordManualPayment.run({
      data: { jobId: job.id, method: "upi_manual" },
      auth: studioAuth(studioUid),
    } as never);

    const invoiceSnap = await db.collection("invoices").doc(recorded.invoiceId).get();
    const invoice = invoiceSnap.data() as Invoice;
    expect(invoice.jobId).toBe(job.id);
    expect(invoice.bookingId).toBeNull();
    expect(invoice.customerId).toBe(customerId);
  });

  it("7. invoice is immutable — a second recordManualPayment on the same job is rejected, original invoice untouched", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const first = await recordManualPayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: studioAuth(studioUid),
    } as never);

    await expect(
      recordManualPayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: studioAuth(studioUid),
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });

    const invoiceSnap = await db.collection("invoices").doc(first.invoiceId).get();
    expect((invoiceSnap.data() as Invoice).total).toBe(job.priceBreakdown.total);
  });

  it("7b. concurrent recordManualPayment calls on the same job: exactly one succeeds, no duplicate payment/invoice (Phase 5A security audit fix, Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) —
    // deterministic once fixed (the in-flight-payment check re-reads inside
    // the transaction), but the loop guards against a future regression
    // with far higher confidence than one pair.
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const jobResult = await createWalkinJob.run({
        data: {
          serviceId: service.id,
          vehicleId: vehicle.id,
          vehicleCategory: "hatchback",
          bayId: nextBay(),
          customerId,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(studioUid),
      } as never);
      const job = jobResult.job as ServiceJob;

      const results = await Promise.allSettled([
        recordManualPayment.run({ data: { jobId: job.id, method: "cash" }, auth: studioAuth(studioUid) } as never),
        recordManualPayment.run({ data: { jobId: job.id, method: "cash" }, auth: studioAuth(studioUid) } as never),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled, `iteration ${i}`).toHaveLength(1);
      expect(rejected, `iteration ${i}`).toHaveLength(1);

      const paymentsSnap = await db.collection("payments").where("jobId", "==", job.id).get();
      expect(paymentsSnap.docs, `iteration ${i}`).toHaveLength(1);
      const invoicesSnap = await db.collection("invoices").where("jobId", "==", job.id).get();
      expect(invoicesSnap.docs, `iteration ${i}`).toHaveLength(1);
    }
  }, 180_000);

  it("8. payment idempotency — confirming the same mock event twice does not double-process", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const initiated = await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never);

    const first = await confirmPaymentMock.run({
      data: { paymentId: initiated.paymentId, mockResult: "success" },
      auth: studioAuth(studioUid),
    } as never);
    expect(first.idempotent).toBe(false);
    const paymentAfterFirst = (await db.collection("payments").doc(initiated.paymentId).get()).data() as Payment;

    const second = await confirmPaymentMock.run({
      data: { paymentId: initiated.paymentId, mockResult: "success" },
      auth: studioAuth(studioUid),
    } as never);
    expect(second.idempotent).toBe(true);
    const paymentAfterSecond = (await db.collection("payments").doc(initiated.paymentId).get()).data() as Payment;

    // Same invoiceId — no second invoice was created
    expect(paymentAfterSecond.invoiceId).toBe(paymentAfterFirst.invoiceId);
  });

  it("9. customer cannot confirm their own payment (permission-denied)", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const initiated = await initiatePayment.run({
      data: { jobId: job.id, method: "cash" },
      auth: customerAuth(customerId),
    } as never);

    await expect(
      confirmPaymentMock.run({
        data: { paymentId: initiated.paymentId, mockResult: "success" },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });

    await expect(
      recordManualPayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const paymentSnap = await db.collection("payments").doc(initiated.paymentId).get();
    expect((paymentSnap.data() as Payment).status).toBe("pending"); // unchanged
  });

  it("10. cross-tenant isolation — a tenant-B studio user cannot initiate or record payment on tenant-A's walk-in job", async () => {
    const jobResult = await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "hatchback",
        bayId: nextBay(),
        customerId,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never);
    const job = jobResult.job as ServiceJob;

    const tenantBUser = uid("tenantb-studio");
    await expect(
      recordManualPayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: studioAuth(tenantBUser, TENANT_B),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const tenantBCustomer = uid("tenantb-cust");
    await expect(
      initiatePayment.run({
        data: { jobId: job.id, method: "cash" },
        auth: customerAuth(tenantBCustomer, TENANT_B),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("11. historical price is unchanged after a later catalogue price change; new walk-ins use the new price", async () => {
    const jobBefore = (
      await createWalkinJob.run({
        data: {
          serviceId: service.id,
          vehicleId: vehicle.id,
          vehicleCategory: "hatchback",
          bayId: nextBay(),
          customerId,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(studioUid),
      } as never)
    ).job as ServiceJob;
    expect(jobBefore.priceBreakdown.basePrice).toBe(40000);

    // Admin raises the catalogue price
    await updateService.run({
      data: { serviceId: service.id, basePrice: 80000 },
      auth: adminAuth(adminUid),
    } as never);

    // The already-created job's snapshot must not change
    const jobBeforeSnap = await db.collection("jobs").doc(jobBefore.id).get();
    expect((jobBeforeSnap.data() as ServiceJob).priceBreakdown.basePrice).toBe(40000);

    // A NEW walk-in created after the change uses the new price
    const jobAfter = (
      await createWalkinJob.run({
        data: {
          serviceId: service.id,
          vehicleId: vehicle.id,
          vehicleCategory: "hatchback",
          bayId: nextBay(),
          customerId,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(studioUid),
      } as never)
    ).job as ServiceJob;
    expect(jobAfter.priceBreakdown.basePrice).toBe(80000);
  });
});

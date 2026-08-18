/**
 * Emulator integration tests for the Garage / Vehicle Ownership system
 * (Phase 2D: Protection domain, Warranty issuance, Passport/history).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 *
 * Function-invocation tests use the real exported Cloud Function handlers
 * via `.run({ data, auth } as never)` — same pattern as
 * membership.emulator.test.ts. Firestore-rules-only assertions (ownership,
 * cross-customer/cross-tenant denial, warranty immutability) live in
 * security-rules.emulator.test.ts alongside every other collection's rules
 * tests, not here.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, Warranty, Protection } from "@autodeck/core";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createBooking } from "../../functions/booking/createBooking.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { createProtection } from "../../functions/protection/createProtection.js";
import { updateProtection } from "../../functions/protection/updateProtection.js";
import { createService } from "../../functions/service/createService.js";
import { updateService } from "../../functions/service/updateService.js";

const db = getFirestore();

const TENANT_A = "garage-tenant-a";
const TENANT_B = "garage-tenant-b";
const STUDIO_ID = "garage-studio";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null } };
}
function studioAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId: STUDIO_ID } };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null } };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

let dayOffset = 2;
function nextDate(): string {
  dayOffset += 1;
  return new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
}

async function seedStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Garage Test Studio",
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
      id: `${studioId}-protection-${i + 1}`,
      tenantId,
      studioId,
      name: `Protection Bay ${i + 1}`,
      bayType: "protection" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
}

async function seedService(
  serviceId: string,
  tenantId: string,
  warrantyLabel: string | null,
  duration?: { value: number; unit: "days" | "months" | "years" | "lifetime" },
) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Gloss PPF",
    category: "ppf",
    brand: "LLumar",
    description: "Full body PPF",
    basePrice: 5000000,
    currency: "INR",
    estimatedDurationMinutes: 60,
    warrantyLabel,
    warrantyDurationValue: duration?.value ?? null,
    warrantyDurationUnit: duration?.unit ?? null,
    vehicleCategoryPricing: [],
    requiredBayType: "protection",
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
    registrationNumber: "GJ01GB" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Toyota",
    model: "Fortuner",
    year: 2023,
    color: "White",
    category: "suv",
    photoUrl: null,
    odometer: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("vehicles").doc(vehicleId).set(vehicle);
  return vehicle;
}

async function bookOnce(cust: string, vehicleId: string, service: Service, tenantId = TENANT_A, studioId = STUDIO_ID) {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId,
      vehicleCategory: "suv",
      studioId,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(cust, tenantId),
  } as never)) as { booking: Booking };
  return result.booking;
}

async function jobForBooking(bookingId: string) {
  const snap = await db.collection("jobs").where("bookingId", "==", bookingId).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) throw new Error(`No job found for booking ${bookingId}`);
  return doc;
}

async function deliverJob(jobId: string, studioUid: string, tenantId = TENANT_A) {
  // PENDING_VEHICLE -> VEHICLE_RECEIVED -> IN_PROGRESS -> QUALITY_CHECK -> READY_FOR_DELIVERY -> DELIVERED
  for (let i = 0; i < 5; i++) {
    await advanceJobStatus.run({ data: { jobId }, auth: studioAuth(studioUid, tenantId) } as never);
  }
}

describe("Garage / Vehicle Ownership system", () => {
  let ppfService: Service;
  let adminUid: string;
  let studioUid: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT_A);
    ppfService = await seedService(uid("service"), TENANT_A, "5-Year PPF Film Warranty");
    adminUid = uid("admin");
    studioUid = uid("studio");
  });

  it("live service completion issues a Warranty derived from the job/service snapshot", async () => {
    const cust = uid("cust-complete");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, ppfService);
    const jobDoc = await jobForBooking(booking.id);

    await deliverJob(jobDoc.id, studioUid);

    const warrantySnap = await db.collection("warranties").doc(jobDoc.id).get();
    expect(warrantySnap.exists).toBe(true);
    const warranty = warrantySnap.data() as Warranty;
    expect(warranty.customerId).toBe(cust);
    expect(warranty.vehicleId).toBe(vehicle.id);
    expect(warranty.jobId).toBe(jobDoc.id);
    expect(warranty.bookingId).toBe(booking.id);
    expect(warranty.serviceName).toBe(ppfService.name);
    expect(warranty.warrantyLabel).toBe("5-Year PPF Film Warranty");
    expect(warranty.revokedAt).toBeNull();
  });

  it("a wash-only service (no warrantyLabel) issues no Warranty on completion", async () => {
    const cust = uid("cust-wash");
    const washService = await seedService(uid("service-wash"), TENANT_A, null);
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, washService);
    const jobDoc = await jobForBooking(booking.id);

    await deliverJob(jobDoc.id, studioUid);

    const warrantySnap = await db.collection("warranties").doc(jobDoc.id).get();
    expect(warrantySnap.exists).toBe(false);
  });

  it("7. duplicate/retry: forcing a second DELIVERED transition never creates a second Warranty", async () => {
    const cust = uid("cust-retry");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, ppfService);
    const jobDoc = await jobForBooking(booking.id);

    await deliverJob(jobDoc.id, studioUid);
    const firstSnap = await db.collection("warranties").doc(jobDoc.id).get();
    expect(firstSnap.exists).toBe(true);

    // Simulate a retried completion event: force the job back to
    // READY_FOR_DELIVERY (bypassing the function) so advanceJobStatus's
    // transition guard allows a second DELIVERED transition to be attempted.
    await db.collection("jobs").doc(jobDoc.id).update({ status: "READY_FOR_DELIVERY" });
    await advanceJobStatus.run({ data: { jobId: jobDoc.id }, auth: studioAuth(studioUid) } as never);

    const allWarranties = await db.collection("warranties").where("jobId", "==", jobDoc.id).get();
    expect(allWarranties.docs.length).toBe(1);
    expect(allWarranties.docs[0]?.data().sealedAt).toBe((firstSnap.data() as Warranty).sealedAt);
  });

  it("6. historical warranty (label AND duration) survives a later catalogue change", async () => {
    const cust = uid("cust-catalogue");
    const serviceForThis = await seedService(uid("service-hist"), TENANT_A, "3-Year Ceramic Warranty", {
      value: 3,
      unit: "years",
    });
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, serviceForThis);
    const jobDoc = await jobForBooking(booking.id);

    await deliverJob(jobDoc.id, studioUid);
    const warrantyBefore = (await db.collection("warranties").doc(jobDoc.id).get()).data() as Warranty;
    expect(warrantyBefore.warrantyLabel).toBe("3-Year Ceramic Warranty");
    const expectedEndDate = warrantyBefore.endDate;
    expect(expectedEndDate).not.toBeNull();

    await updateService.run({
      data: {
        serviceId: serviceForThis.id,
        warrantyLabel: "Rewritten Warranty Terms",
        warrantyDurationValue: 10,
        warrantyDurationUnit: "years",
      },
      auth: adminAuth(adminUid),
    } as never);

    const warrantyAfter = (await db.collection("warranties").doc(jobDoc.id).get()).data() as Warranty;
    expect(warrantyAfter.warrantyLabel).toBe("3-Year Ceramic Warranty");
    expect(warrantyAfter.warrantyLabel).not.toBe("Rewritten Warranty Terms");
    expect(warrantyAfter.endDate).toBe(expectedEndDate);
  });

  it("8. a warranty issued before this fix (endDate null, unconfigured service) remains unchanged by an unrelated catalogue edit", async () => {
    const cust = uid("cust-preexisting");
    // Service left unconfigured on purpose — simulates a warranty issued
    // under the pre-2D.1 model (endDate always null).
    const serviceForThis = await seedService(uid("service-legacy"), TENANT_A, "Legacy Warranty Label");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, serviceForThis);
    const jobDoc = await jobForBooking(booking.id);

    await deliverJob(jobDoc.id, studioUid);
    const before = (await db.collection("warranties").doc(jobDoc.id).get()).data() as Warranty;
    expect(before.endDate).toBeNull();

    // An unrelated field edit on the same service must not retroactively
    // compute or backfill an endDate on the already-issued warranty.
    await updateService.run({
      data: { serviceId: serviceForThis.id, description: "Updated description only" },
      auth: adminAuth(adminUid),
    } as never);

    const after = (await db.collection("warranties").doc(jobDoc.id).get()).data() as Warranty;
    expect(after.endDate).toBeNull();
    expect(after.warrantyLabel).toBe("Legacy Warranty Label");
  });

  it("live protection verification: admin creates then verifies a protection", async () => {
    const cust = uid("cust-protect");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);

    const createResult = (await createProtection.run({
      data: { vehicleId: vehicle.id, kind: "insurance", provider: "Acme Insurance", expiryDate: "2027-01-01" },
      auth: adminAuth(adminUid),
    } as never)) as { protection: Protection };
    expect(createResult.protection.status).toBe("unverified");
    expect(createResult.protection.customerId).toBe(cust);

    await updateProtection.run({
      data: { vehicleId: vehicle.id, protectionId: createResult.protection.id, status: "verified" },
      auth: adminAuth(adminUid),
    } as never);

    const snap = await db
      .collection("vehicles")
      .doc(vehicle.id)
      .collection("protections")
      .doc(createResult.protection.id)
      .get();
    const protection = snap.data() as Protection;
    expect(protection.status).toBe("verified");
    expect(protection.verifiedBy).toBe(adminUid);
    expect(protection.verifiedAt).not.toBeNull();
  });

  it("studio role cannot create or verify a protection (admin only)", async () => {
    const cust = uid("cust-studio-deny");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    await expect(
      createProtection.run({
        data: { vehicleId: vehicle.id, kind: "puc" },
        auth: studioAuth(studioUid),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("cross-tenant: admin cannot create a protection for a vehicle in another tenant", async () => {
    const custB = uid("cust-b");
    const vehicleB = await seedVehicle(uid("veh-b"), TENANT_B, custB);
    await expect(
      createProtection.run({
        data: { vehicleId: vehicleB.id, kind: "insurance" },
        auth: adminAuth(adminUid, TENANT_A),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("live passport/history: a vehicle's jobs are queryable by vehicleId + owner after completion", async () => {
    const cust = uid("cust-passport");
    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, ppfService);
    const jobDoc = await jobForBooking(booking.id);
    await deliverJob(jobDoc.id, studioUid);

    const historySnap = await db
      .collection("jobs")
      .where("vehicleId", "==", vehicle.id)
      .where("tenantId", "==", TENANT_A)
      .where("customerId", "==", cust)
      .get();
    expect(historySnap.docs.length).toBe(1);
    const historyJob = historySnap.docs[0]?.data() as ServiceJob;
    expect(historyJob.status).toBe("DELIVERED");
  });
});

// ─── Admin warranty duration configuration (Phase 2D.2) ────────────────────────
// The admin UI is a thin form over createService/updateService — these tests
// exercise those same Cloud Functions directly, since the Next.js layer adds
// no validation of its own (per the phase instruction: don't duplicate it).

function newServicePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Config Test Service",
    category: "ppf" as const,
    brand: null,
    description: "Test service for warranty configuration",
    basePrice: 1000000,
    estimatedDurationMinutes: 60,
    warrantyLabel: "Configured Warranty",
    requiredBayType: "protection" as const, // matches this file's seeded studio bays
    ...overrides,
  };
}

describe("Admin warranty duration configuration", () => {
  let adminUid: string;
  let studioUid: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT_A); // idempotent re-seed — independent describe block
    adminUid = uid("admin-config");
    studioUid = uid("studio-config");
  });

  it("1. create service with duration (days/months/years all accepted)", async () => {
    for (const [unit, value] of [
      ["days", 90],
      ["months", 6],
      ["years", 5],
    ] as const) {
      const result = (await createService.run({
        data: newServicePayload({ warrantyDurationUnit: unit, warrantyDurationValue: value }),
        auth: adminAuth(adminUid),
      } as never)) as { service: Service };
      expect(result.service.warrantyDurationUnit).toBe(unit);
      expect(result.service.warrantyDurationValue).toBe(value);
    }
  });

  it("2. update duration on an existing service", async () => {
    const created = (await createService.run({
      data: newServicePayload({ warrantyDurationUnit: "months", warrantyDurationValue: 3 }),
      auth: adminAuth(adminUid),
    } as never)) as { service: Service };

    await updateService.run({
      data: { serviceId: created.service.id, warrantyDurationUnit: "years", warrantyDurationValue: 2 },
      auth: adminAuth(adminUid),
    } as never);

    const snap = await db.collection("services").doc(created.service.id).get();
    const updated = snap.data() as Service;
    expect(updated.warrantyDurationUnit).toBe("years");
    expect(updated.warrantyDurationValue).toBe(2);
  });

  it("3. lifetime is accepted with a null duration value", async () => {
    const result = (await createService.run({
      data: newServicePayload({ warrantyDurationUnit: "lifetime", warrantyDurationValue: null }),
      auth: adminAuth(adminUid),
    } as never)) as { service: Service };
    expect(result.service.warrantyDurationUnit).toBe("lifetime");
    expect(result.service.warrantyDurationValue).toBeNull();
  });

  it("4. invalid duration values are rejected (zero, negative, non-integer)", async () => {
    for (const invalid of [0, -5, 1.5]) {
      await expect(
        createService.run({
          data: newServicePayload({ warrantyDurationUnit: "days", warrantyDurationValue: invalid }),
          auth: adminAuth(adminUid),
        } as never),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    }
  });

  it("5. empty/unconfigured (both fields omitted or null) is accepted", async () => {
    const result = (await createService.run({
      data: newServicePayload(),
      auth: adminAuth(adminUid),
    } as never)) as { service: Service };
    expect(result.service.warrantyDurationUnit).toBeNull();
    expect(result.service.warrantyDurationValue).toBeNull();
  });

  it("7. completing a job after admin configures duration produces the correct Warranty.endDate", async () => {
    const cust = uid("cust-configured-flow");
    const created = (await createService.run({
      data: newServicePayload({ warrantyLabel: "Configured Flow Warranty" }), // unconfigured at first
      auth: adminAuth(adminUid),
    } as never)) as { service: Service };

    // Admin configures duration only after the service already exists —
    // exercises the update path, not just create.
    await updateService.run({
      data: { serviceId: created.service.id, warrantyDurationUnit: "years", warrantyDurationValue: 3 },
      auth: adminAuth(adminUid),
    } as never);

    const configuredService = (await db.collection("services").doc(created.service.id).get()).data() as Service;

    const vehicle = await seedVehicle(uid("veh"), TENANT_A, cust);
    const booking = await bookOnce(cust, vehicle.id, configuredService);
    const jobDoc = await jobForBooking(booking.id);
    await deliverJob(jobDoc.id, studioUid);

    const warranty = (await db.collection("warranties").doc(jobDoc.id).get()).data() as Warranty;
    expect(warranty.warrantyLabel).toBe("Configured Flow Warranty");
    expect(warranty.endDate).not.toBeNull();
    const expected = new Date(warranty.startDate);
    expected.setUTCFullYear(expected.getUTCFullYear() + 3);
    expect(warranty.endDate).toBe(expected.toISOString().slice(0, 10));
  });
});

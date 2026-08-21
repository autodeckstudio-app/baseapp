/**
 * Emulator tests for the structured inspection workflow (Phase 4).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, Inspection, AuditLog } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createBooking } from "../../functions/booking/createBooking.js";
import { startInspection } from "../../functions/inspection/startInspection.js";
import { updateInspection } from "../../functions/inspection/updateInspection.js";
import { finalizeInspection } from "../../functions/inspection/finalizeInspection.js";

const db = getFirestore();

const TENANT_A = "insp-tenant-a";
const TENANT_B = "insp-tenant-b";
const STUDIO_A = "insp-studio-a";
const STUDIO_B = "insp-studio-b";

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
    name: "Inspection Test Studio",
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
    name: "Inspection Test Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice: 50000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType: "wash",
    membershipWashEligible: true,
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
    registrationNumber: "GJ01IN" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
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
  scheduledDate = nextDate(),
): Promise<{ booking: Booking; job: ServiceJob }> {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "hatchback",
      studioId,
      scheduledDate,
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerId, tenantId),
  } as never)) as { booking: Booking };

  const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", result.booking.id).get();
  const job = jobsSnap.docs[0]?.data() as ServiceJob;
  return { booking: result.booking, job };
}

// Each test gets its own customer+vehicle — booking.create is rate-limited
// to 10/60s per customer, and this file's 11+ tests each create a booking.
async function freshJob(
  service: Service,
  studioId: string,
  tenantId = TENANT_A,
  scheduledDate?: string,
): Promise<{ booking: Booking; job: ServiceJob; customerId: string }> {
  const customerId = uid("cust");
  const vehicle = await seedVehicle(uid("veh"), tenantId, customerId);
  const { booking, job } = await makeBookingAndJob(
    customerId,
    service,
    vehicle,
    studioId,
    tenantId,
    ...(scheduledDate !== undefined ? [scheduledDate] : []),
  );
  return { booking, job, customerId };
}

describe("Inspection workflow — start / update / finalize", () => {
  let service: Service;

  beforeAll(async () => {
    await seedStudio(STUDIO_A, TENANT_A);
    await seedStudio(STUDIO_B, TENANT_A);
    await seedStudio("insp-studio-tenant-b", TENANT_B);
    service = await seedService(uid("svc"), TENANT_A);
  });

  it("studio starts an inspection with a service-appropriate checklist", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    const result = (await startInspection.run({
      data: { jobId: job.id },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never)) as { inspection: Inspection };

    expect(result.inspection.status).toBe("in_progress");
    expect(result.inspection.serviceCategory).toBe("washing");
    const keys = result.inspection.checklist.map((i) => i.key);
    expect(keys).toContain("exterior_condition"); // washing service-specific item
    expect(result.inspection.checklist.every((i) => i.rating === null)).toBe(true);

    const auditSnap = await db
      .collection(COLLECTIONS.auditLog())
      .where("tenantId", "==", TENANT_A)
      .where("entityType", "==", "Inspection")
      .where("entityId", "==", job.id)
      .get();
    expect(auditSnap.docs.some((d) => (d.data() as AuditLog).action === "inspection.started")).toBe(true);
  });

  it("cannot start a second inspection for the same job", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);
    await expect(
      startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never),
    ).rejects.toThrow(/already been started/);
  });

  it("studio records checklist findings and overall notes", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);

    await updateInspection.run({
      data: {
        jobId: job.id,
        items: [
          { key: "paint_condition", rating: "good", notes: "No visible issues" },
          { key: "scratches", rating: "fair", notes: "Minor scratch on rear bumper" },
        ],
        overallNotes: "Vehicle in good overall condition",
      },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never);

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    const inspection = snap.data() as Inspection;
    const paint = inspection.checklist.find((i) => i.key === "paint_condition");
    const scratches = inspection.checklist.find((i) => i.key === "scratches");
    expect(paint?.rating).toBe("good");
    expect(scratches?.rating).toBe("fair");
    expect(scratches?.notes).toBe("Minor scratch on rear bumper");
    expect(inspection.overallNotes).toBe("Vehicle in good overall condition");
  });

  it("rejects updating an unknown checklist key", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);
    await expect(
      updateInspection.run({
        data: { jobId: job.id, items: [{ key: "not_a_real_key", rating: "good" }] },
        auth: studioAuth(uid("studio-user"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/Unknown checklist item/);
  });

  it("finalizes an inspection and blocks further edits (immutability)", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);
    await updateInspection.run({
      data: { jobId: job.id, items: [{ key: "paint_condition", rating: "good" }] },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never);

    const result = (await finalizeInspection.run({
      data: { jobId: job.id },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never)) as { alreadyFinalized: boolean };
    expect(result.alreadyFinalized).toBe(false);

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect((snap.data() as Inspection).status).toBe("finalized");

    await expect(
      updateInspection.run({
        data: { jobId: job.id, items: [{ key: "paint_condition", rating: "poor" }] },
        auth: studioAuth(uid("studio-user"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/already been finalized/);
  });

  it("finalizing twice is idempotent — no duplicate audit entry, same result", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);

    await finalizeInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);
    const second = (await finalizeInspection.run({
      data: { jobId: job.id },
      auth: studioAuth(uid("studio-user"), STUDIO_A),
    } as never)) as { alreadyFinalized: boolean };
    expect(second.alreadyFinalized).toBe(true);

    const auditSnap = await db
      .collection(COLLECTIONS.auditLog())
      .where("tenantId", "==", TENANT_A)
      .where("entityType", "==", "Inspection")
      .where("entityId", "==", job.id)
      .get();
    const finalizedEntries = auditSnap.docs.filter((d) => (d.data() as AuditLog).action === "inspection.finalized");
    expect(finalizedEntries.length).toBe(1);
  });

  it("customer cannot start, update, or finalize an inspection", async () => {
    const { job, customerId } = await freshJob(service, STUDIO_A);
    await expect(
      startInspection.run({ data: { jobId: job.id }, auth: customerAuth(customerId) } as never),
    ).rejects.toThrow(/Studio or admin role required/);

    await startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never);
    await expect(
      updateInspection.run({
        data: { jobId: job.id, overallNotes: "hacked" },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/Studio or admin role required/);
    await expect(
      finalizeInspection.run({ data: { jobId: job.id }, auth: customerAuth(customerId) } as never),
    ).rejects.toThrow(/Studio or admin role required/);
  });

  it("studio from a different studio cannot start an inspection for another studio's job", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await expect(
      startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-b-user"), STUDIO_B) } as never),
    ).rejects.toThrow(/different studio/);
  });

  it("staff from a different tenant cannot start an inspection", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await expect(
      startInspection.run({ data: { jobId: job.id }, auth: adminAuth(uid("tenant-b-admin"), TENANT_B) } as never),
    ).rejects.toThrow(/Cross-tenant/);
  });

  it("cannot start an inspection for a cancelled job", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await db.collection(COLLECTIONS.jobs()).doc(job.id).update({ status: "CANCELLED" });
    await expect(
      startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user"), STUDIO_A) } as never),
    ).rejects.toThrow(/CANCELLED/);
  });

  it("admin can also perform the full inspection flow (tenant-wide role parity)", async () => {
    const { job } = await freshJob(service, STUDIO_A);
    await startInspection.run({ data: { jobId: job.id }, auth: adminAuth(uid("admin-user")) } as never);
    await updateInspection.run({
      data: { jobId: job.id, items: [{ key: "paint_condition", rating: "good" }] },
      auth: adminAuth(uid("admin-user")),
    } as never);
    const result = (await finalizeInspection.run({
      data: { jobId: job.id },
      auth: adminAuth(uid("admin-user")),
    } as never)) as { alreadyFinalized: boolean };
    expect(result.alreadyFinalized).toBe(false);
  });

  it("concurrent start attempts on the same job: exactly one succeeds (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) —
    // deterministic once fixed (startInspection uses tx.create() for the
    // one-per-job invariant), but the loop guards against a future
    // regression with far higher confidence than one pair. Each iteration
    // uses its own fresh single-purpose studio so it's safe to reuse the
    // SAME booking date instead of calling nextDate() per iteration (which
    // draws from this file's shared, monotonic, 30-day-bounded counter and
    // would exhaust it for other tests in this file).
    const raceDate = nextDate();
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const raceStudioId = uid("insp-race-studio");
      await seedStudio(raceStudioId, TENANT_A);
      const { job } = await freshJob(service, raceStudioId, TENANT_A, raceDate);
      const results = await Promise.allSettled([
        startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user-1"), raceStudioId) } as never),
        startInspection.run({ data: { jobId: job.id }, auth: studioAuth(uid("studio-user-2"), raceStudioId) } as never),
      ]);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      expect(succeeded.length, `iteration ${i}`).toBe(1);
    }
  }, 180_000);
});

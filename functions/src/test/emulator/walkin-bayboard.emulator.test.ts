/**
 * Emulator integration tests for Phase 3B: Studio Walk-in registration and
 * the Bay Board's data model. Run with: pnpm test:emulator (requires
 * Firestore Emulator at localhost:8080).
 *
 * Complements walkin-financial.emulator.test.ts (which covers the walk-in
 * -> payment -> invoice financial flow) with the permission-boundary and
 * concurrency coverage specific to this phase: cross-tenant/cross-studio
 * denial on job creation itself, invalid service/bay combinations,
 * concurrent bay assignment races, and customer-side visibility of a
 * walk-in job (doc06: walk-ins are real ServiceJob documents — no
 * fabricated booking, no separate customer-visibility mechanism needed).
 *
 * STUDIO_ID is seeded with a generous, uniquely-allocated bay pool so
 * sequential tests never collide on bay occupancy (same technique as
 * walkin-financial.emulator.test.ts). REAL_STUDIO_ID is seeded separately
 * with the exact real-world shape (2 washing + 3 protection bays) to verify
 * the Bay Board reads that configuration correctly.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Customer, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { createVehicle } from "../../functions/vehicle/createVehicle.js";
import { assignBay } from "../../functions/job/assignBay.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";

const db = getFirestore();

const TENANT_A = "wb-tenant-a";
const TENANT_B = "wb-tenant-b";
const STUDIO_ID = "wb-studio";
const OTHER_STUDIO_ID = "wb-studio-other";
const REAL_STUDIO_ID = "wb-real-studio";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null } };
}
function studioAuth(authUid: string, tenantId = TENANT_A, studioId = STUDIO_ID) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId } };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null } };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

// Phase 5B P2-4: bumped from 15 to accommodate tests 9 and 17's 20-iteration
// stress loops (each iteration consumes one fresh bay) alongside the file's
// other static bay consumers.
const BAY_COUNT_PER_TYPE = 40;

async function seedGenerousStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Bay Board Test Studio",
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
    bays: [
      ...Array.from({ length: BAY_COUNT_PER_TYPE }, (_, i) => ({
        id: `${studioId}-wash-${i + 1}`,
        tenantId,
        studioId,
        name: `Wash Bay ${i + 1}`,
        bayType: "wash" as const,
        active: true,
      })),
      ...Array.from({ length: BAY_COUNT_PER_TYPE }, (_, i) => ({
        id: `${studioId}-protection-${i + 1}`,
        tenantId,
        studioId,
        name: `Protection Bay ${i + 1}`,
        bayType: "protection" as const,
        active: true,
      })),
    ],
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

// The real studio configuration: exactly 2 washing bays + 3 protection bays.
async function seedRealStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Real Shape Studio",
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
    bays: [
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `${studioId}-wash-${i + 1}`,
        tenantId,
        studioId,
        name: `Wash Bay ${i + 1}`,
        bayType: "wash" as const,
        active: true,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `${studioId}-protection-${i + 1}`,
        tenantId,
        studioId,
        name: `Protection Bay ${i + 1}`,
        bayType: "protection" as const,
        active: true,
      })),
    ],
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

let washCounter = 0;
function nextWashBay(): string {
  washCounter += 1;
  if (washCounter > BAY_COUNT_PER_TYPE) throw new Error("Exhausted seeded wash bays — increase BAY_COUNT_PER_TYPE.");
  return `${STUDIO_ID}-wash-${washCounter}`;
}
let protectionCounter = 0;
function nextProtectionBay(): string {
  protectionCounter += 1;
  if (protectionCounter > BAY_COUNT_PER_TYPE) {
    throw new Error("Exhausted seeded protection bays — increase BAY_COUNT_PER_TYPE.");
  }
  return `${STUDIO_ID}-protection-${protectionCounter}`;
}

async function seedService(
  serviceId: string,
  tenantId: string,
  requiredBayType: "wash" | "protection" = "wash",
) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: requiredBayType === "wash" ? "Walk-in Wash" : "Walk-in PPF",
    category: requiredBayType === "wash" ? "washing" : "ppf",
    brand: null,
    description: "Test service",
    basePrice: 50000,
    currency: "INR",
    estimatedDurationMinutes: 45,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType,
    membershipWashEligible: false,
    active: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

async function seedCustomer(customerId: string, tenantId: string) {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: customerId,
    tenantId,
    authUid: customerId,
    name: "Walk-in Bay Board Customer",
    phone: "+919876511111",
    notificationPrefs: { push: true, quietMode: false },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("customers").doc(customerId).set(customer);
  return customer;
}

async function seedVehicle(vehicleId: string, tenantId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber: "GJ01WB" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Hyundai",
    model: "Creta",
    year: 2023,
    color: "Blue",
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

describe("Walk-in registration + Bay Board (Phase 3B)", () => {
  let washService: Service;
  let ppfService: Service;
  let customer: Customer;
  let vehicle: Vehicle;
  let studioUid: string;

  beforeAll(async () => {
    await seedGenerousStudio(STUDIO_ID, TENANT_A);
    await seedGenerousStudio(OTHER_STUDIO_ID, TENANT_A);
    await seedRealStudio(REAL_STUDIO_ID, TENANT_A);
    washService = await seedService(uid("svc-wash"), TENANT_A, "wash");
    ppfService = await seedService(uid("svc-ppf"), TENANT_A, "protection");
    const custId = uid("cust");
    customer = await seedCustomer(custId, TENANT_A);
    vehicle = await seedVehicle(uid("veh"), TENANT_A, custId);
    studioUid = uid("studio-user");
  });

  it("1. studio creates a walk-in job — real jobId, no fabricated bookingId, immediately queryable (Bay Board data source)", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: nextWashBay(),
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    expect(result.job.bookingId).toBeNull();
    expect(result.job.isWalkIn).toBe(true);

    // What the Bay Board's listenToJobsByDate query would see.
    const boardSnap = await db
      .collection("jobs")
      .where("studioId", "==", STUDIO_ID)
      .where("tenantId", "==", TENANT_A)
      .where("scheduledDate", "==", result.job.scheduledDate)
      .get();
    expect(boardSnap.docs.some((d) => d.id === result.job.id)).toBe(true);

    const auditSnap = await db
      .collection("auditLog")
      .where("action", "==", "job.walkin_created")
      .where("entityId", "==", result.job.id)
      .get();
    expect(auditSnap.empty).toBe(false);
  });

  it("2. price is server-computed, never trusted from the client (walk-in reuses the shared pricing engine)", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: nextWashBay(),
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };
    // 50000 base + 18% GST = 59000
    expect(result.job.totalAmount).toBe(59000);
  });

  it("3. customer sees the walk-in job through the same query the customer app's Passport uses — no separate mechanism needed", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: nextWashBay(),
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    const historySnap = await db
      .collection("jobs")
      .where("vehicleId", "==", vehicle.id)
      .where("tenantId", "==", TENANT_A)
      .where("customerId", "==", customer.id)
      .get();
    expect(historySnap.docs.some((d) => d.id === result.job.id)).toBe(true);
  });

  it("4. customer cannot create a walk-in job", async () => {
    await expect(
      createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "suv",
          bayId: nextWashBay(),
          customerId: customer.id,
          studioId: STUDIO_ID,
        },
        auth: customerAuth(customer.id),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("5. cross-studio: a studio user assigned to a different studio cannot create a walk-in for this studio", async () => {
    await expect(
      createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "suv",
          bayId: nextWashBay(),
          customerId: customer.id,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(uid("other-studio-user"), TENANT_A, OTHER_STUDIO_ID),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("6. cross-tenant: a tenant-B studio/admin user cannot create a walk-in in tenant A", async () => {
    await expect(
      createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "suv",
          bayId: nextWashBay(),
          customerId: customer.id,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(uid("tenantb-studio"), TENANT_B, STUDIO_ID),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });

    await expect(
      createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "suv",
          bayId: nextWashBay(),
          customerId: customer.id,
          studioId: STUDIO_ID,
        },
        auth: adminAuth(uid("tenantb-admin"), TENANT_B),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("7. invalid service/bay-type combination is rejected (a wash service cannot use a protection bay)", async () => {
    await expect(
      createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "suv",
          bayId: nextProtectionBay(),
          customerId: customer.id,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(studioUid),
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("8. vehicle must belong to the given customer", async () => {
    const otherCustomer = await seedCustomer(uid("cust-other"), TENANT_A);
    await expect(
      createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id, // belongs to `customer`, not `otherCustomer`
          vehicleCategory: "suv",
          bayId: nextWashBay(),
          customerId: otherCustomer.id,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(studioUid),
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("9. concurrent walk-in creation on the same bay: exactly one succeeds, the other gets a clear recoverable error (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) — a
    // single concurrent pair has a real chance of passing even when the
    // underlying race is present: Firestore's transaction conflict
    // detection on a query read is not 100% reliable (see
    // COLLECTIONS.bayLocks' doc comment). Before the bayLocks mitigation
    // (Phase 5B P1-1), createWalkinJob had no protection at all against
    // this race, with an empirically measured ~50% double-assignment rate
    // under this exact concurrent-pair pattern — this loop would reliably
    // have surfaced it. Each iteration uses an independent fresh bay.
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const bayId = nextProtectionBay();
      const results = await Promise.allSettled([
        createWalkinJob.run({
          data: {
            serviceId: ppfService.id,
            vehicleId: vehicle.id,
            vehicleCategory: "suv",
            bayId,
            customerId: customer.id,
            studioId: STUDIO_ID,
          },
          auth: studioAuth(studioUid),
        } as never),
        createWalkinJob.run({
          data: {
            serviceId: ppfService.id,
            vehicleId: vehicle.id,
            vehicleCategory: "suv",
            bayId,
            customerId: customer.id,
            studioId: STUDIO_ID,
          },
          auth: studioAuth(studioUid),
        } as never),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(fulfilled.length, `iteration ${i}: expected exactly one winner`).toBe(1);
      expect(rejected.length, `iteration ${i}: expected exactly one loser`).toBe(1);
      expect(
        (rejected[0]?.reason as { code?: string } | undefined)?.code,
        `iteration ${i}: loser should get a clear recoverable error`,
      ).toBe("resource-exhausted");

      // Bay Board query shows exactly one active job on this bay.
      const occupants = await db.collection("jobs").where("studioId", "==", STUDIO_ID).where("bayId", "==", bayId).get();
      const active = occupants.docs.filter((d) => !["DELIVERED", "CANCELLED"].includes((d.data() as ServiceJob).status));
      expect(active.length, `iteration ${i}: bay must never be double-assigned`).toBe(1);
    }
  }, 180_000);

  it("10. studio can register a vehicle on behalf of an existing customer (walk-in intake) — never owned by the studio employee", async () => {
    const result = (await createVehicle.run({
      data: {
        ownerId: customer.id,
        registrationNumber: "GJ01WB9999",
        make: "Tata",
        model: "Nexon",
        year: 2021,
        color: "Red",
      },
      auth: studioAuth(studioUid),
    } as never)) as { vehicle: Vehicle };
    expect(result.vehicle.ownerId).toBe(customer.id);
    expect(result.vehicle.ownerId).not.toBe(studioUid);
  });

  it("customer cannot create a vehicle for another customer", async () => {
    await expect(
      createVehicle.run({
        data: {
          ownerId: uid("someone-else"),
          registrationNumber: "GJ01WB8888",
          make: "Tata",
          model: "Nexon",
          year: 2021,
          color: "Red",
        },
        auth: customerAuth(customer.id),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("11. unauthorized bay mutation: customer cannot reassign a job's bay", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: nextWashBay(),
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    await expect(
      assignBay.run({
        data: { jobId: result.job.id, bayId: nextWashBay() },
        auth: customerAuth(customer.id),
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("12. unauthorized job status mutation: customer cannot advance a job's status", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: nextWashBay(),
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    await expect(
      advanceJobStatus.run({ data: { jobId: result.job.id }, auth: customerAuth(customer.id) } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("13. studio cannot reassign a bay for a job belonging to another studio", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: `${OTHER_STUDIO_ID}-wash-1`,
        customerId: customer.id,
        studioId: OTHER_STUDIO_ID,
      },
      auth: studioAuth(uid("other-studio-user-2"), TENANT_A, OTHER_STUDIO_ID),
    } as never)) as { job: ServiceJob };

    await expect(
      assignBay.run({
        data: { jobId: result.job.id, bayId: `${OTHER_STUDIO_ID}-wash-2` },
        auth: studioAuth(studioUid), // scoped to STUDIO_ID, not OTHER_STUDIO_ID
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("14. Bay Board reads the real 2-washing + 3-protection configuration correctly", async () => {
    const configSnap = await db.collection("studioConfig").doc(REAL_STUDIO_ID).get();
    const config = configSnap.data() as StudioConfig;
    const washBays = config.bays.filter((b) => b.bayType === "wash");
    const protectionBays = config.bays.filter((b) => b.bayType === "protection");
    expect(washBays.length).toBe(2);
    expect(protectionBays.length).toBe(3);
  });

  it("15. assignBay rejects a bay whose type doesn't match the job's service (Phase 5B P1-2 regression)", async () => {
    const result = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: nextWashBay(),
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    await expect(
      assignBay.run({
        data: { jobId: result.job.id, bayId: nextProtectionBay() },
        auth: studioAuth(studioUid),
      } as never),
    ).rejects.toThrow(/not compatible/);

    const jobSnap = await db.collection("jobs").doc(result.job.id).get();
    expect((jobSnap.data() as ServiceJob).bayId).toBe(result.job.bayId);
  });

  it("16. assignBay rejects a bay already occupied by another active job (Phase 5B P1-2 regression)", async () => {
    const occupiedBayId = nextWashBay();
    const freeBayId = nextWashBay();

    const occupant = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: occupiedBayId,
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    const mover = (await createWalkinJob.run({
      data: {
        serviceId: washService.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: freeBayId,
        customerId: customer.id,
        studioId: STUDIO_ID,
      },
      auth: studioAuth(studioUid),
    } as never)) as { job: ServiceJob };

    // occupant is still active (VEHICLE_RECEIVED) and overlaps mover's
    // scheduled window (both "now") — reassigning mover onto occupant's bay
    // must be rejected instead of silently double-booking it.
    await expect(
      assignBay.run({
        data: { jobId: mover.job.id, bayId: occupiedBayId },
        auth: studioAuth(studioUid),
      } as never),
    ).rejects.toThrow(/occupied/);

    const moverSnap = await db.collection("jobs").doc(mover.job.id).get();
    expect((moverSnap.data() as ServiceJob).bayId).toBe(freeBayId);

    const occupantSnap = await db.collection("jobs").doc(occupant.job.id).get();
    expect((occupantSnap.data() as ServiceJob).bayId).toBe(occupiedBayId);
  });

  it("17. two concurrent advanceJobStatus calls on the same job never silently drop a statusHistory entry (Phase 5B P1-5 regression, P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4). Unlike
    // the bay-race tests, this race is fully deterministic once fixed —
    // both sides tx.get() the same job document, so Firestore's conflict
    // detection is guaranteed, not probabilistic — but the loop still
    // guards against a FUTURE regression (e.g. someone reintroducing a
    // blind write) with much higher confidence than one pair.
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const created = (await createWalkinJob.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "suv",
          bayId: nextWashBay(),
          customerId: customer.id,
          studioId: STUDIO_ID,
        },
        auth: studioAuth(studioUid),
      } as never)) as { job: ServiceJob };

      const initialLength = created.job.statusHistory.length;
      expect(created.job.status, `iteration ${i}`).toBe("VEHICLE_RECEIVED");

      const results = await Promise.allSettled([
        advanceJobStatus.run({ data: { jobId: created.job.id }, auth: studioAuth(uid("studio-a")) } as never),
        advanceJobStatus.run({ data: { jobId: created.job.id }, auth: studioAuth(uid("studio-b")) } as never),
      ]);
      const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
      expect(fulfilledCount, `iteration ${i}`).toBeGreaterThanOrEqual(1);

      const finalSnap = await db.collection("jobs").doc(created.job.id).get();
      const finalJob = finalSnap.data() as ServiceJob;
      expect(finalJob.statusHistory.length, `iteration ${i}: no entry silently dropped`).toBe(
        initialLength + fulfilledCount,
      );

      // Every audit log entry for this job's status advancement must be
      // reflected in the final statusHistory — none silently dropped.
      const auditSnap = await db
        .collection(COLLECTIONS.auditLog())
        .where("entityId", "==", created.job.id)
        .where("action", "==", "job.status_advanced")
        .get();
      expect(auditSnap.docs.length, `iteration ${i}`).toBe(fulfilledCount);
      const auditedStatuses = auditSnap.docs.map((d) => (d.data() as { after: { status: string } }).after.status);
      for (const status of auditedStatuses) {
        expect(finalJob.statusHistory.some((h) => h.status === status), `iteration ${i}, status ${status}`).toBe(true);
      }
    }
  }, 180_000);
});

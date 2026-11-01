/**
 * Emulator integration tests for the bay physical-occupancy guards
 * (advanceJobStatus check-in, createWalkinJob, assignBay).
 *
 * The pre-fix holders queries were windowed on scheduledDate
 * (+/-MAX_SERVICE_SPAN_DAYS), so a job that started weeks ago and was never
 * closed - still physically holding its bay - was invisible, and a walk-in
 * or check-in could be admitted over a present car. These tests run the
 * REAL handlers against a real Firestore emulator, including a concurrent
 * same-bay check-in pair that proves the bayLocks write serialization.
 *
 * Run with: pnpm test:emulator (Firestore Emulator; default port overridden
 * via FIRESTORE_EMULATOR_HOST when 8080 is occupied).
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Customer, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { assignBay } from "../../functions/job/assignBay.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";

const db = getFirestore();

const TENANT = "bco-tenant";
const STUDIO_ID = "bco-studio";
const BAY = "bco-wash-1";

function studioAuth(authUid: string) {
  return { uid: authUid, token: { role: "studio", tenantId: TENANT, studioId: STUDIO_ID } };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

const SERVICE_ID = "bco-svc";

async function seedStudio() {
  const studioConfig: StudioConfig = {
    id: STUDIO_ID,
    tenantId: TENANT,
    studioId: STUDIO_ID,
    name: "Occupancy Test Studio",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, open: "00:00", close: "23:59", closed: false })),
    holidays: [],
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30,
    maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: [
      { id: BAY, tenantId: TENANT, studioId: STUDIO_ID, name: "Wash Bay 1", bayType: "wash", active: true },
      { id: "bco-wash-2", tenantId: TENANT, studioId: STUDIO_ID, name: "Wash Bay 2", bayType: "wash", active: true },
    ],
    standbyEnabled: false,
    standbyMaxPerBayType: 0,
  } as unknown as StudioConfig;
  await db.collection(COLLECTIONS.studioConfig()).doc(STUDIO_ID).set(studioConfig);
  const service: Partial<Service> = {
    id: SERVICE_ID,
    tenantId: TENANT,
    name: "Wash",
    category: "washing",
    description: "Test wash",
    basePrice: 40000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    vehicleCategoryPricing: [],
    requiredBayType: "wash",
    membershipWashEligible: false,
    active: true,
    displayOrder: 0,
  };
  await db.collection(COLLECTIONS.services()).doc(SERVICE_ID).set(service);
}

async function seedCustomerAndVehicle(customerId: string, vehicleId: string) {
  const customer: Partial<Customer> = { id: customerId, tenantId: TENANT, name: "Occ Test", phone: "+919000000001" };
  await db.collection(COLLECTIONS.customers()).doc(customerId).set(customer);
  const vehicle: Partial<Vehicle> = {
    id: vehicleId,
    tenantId: TENANT,
    ownerId: customerId,
    make: "QA",
    model: "Car",
    registrationNumber: "GJ01AB1234",
    category: "suv",
  };
  await db.collection(COLLECTIONS.vehicles()).doc(vehicleId).set(vehicle);
}

function jobDoc(id: string, extra: Partial<ServiceJob>): ServiceJob {
  return {
    id,
    tenantId: TENANT,
    studioId: STUDIO_ID,
    bookingId: null,
    customerId: "bco-cust",
    vehicleId: "bco-veh",
    serviceId: SERVICE_ID,
    bayId: BAY,
    assignedEmployeeId: null,
    status: "PENDING_VEHICLE",
    statusHistory: [],
    scheduledDate: "2026-10-30",
    scheduledAt: "2026-10-30T05:00:00.000Z",
    estimatedEndAt: "2026-10-30T06:00:00.000Z",
    estimatedDurationMinutes: 60,
    paymentStatus: "unpaid",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...extra,
  } as ServiceJob;
}

/** An overdue IN_PROGRESS job scheduled over 14 days ago - outside any scheduledDate window around today. */
function overdueHolder(id: string): ServiceJob {
  return jobDoc(id, {
    status: "IN_PROGRESS",
    scheduledDate: "2026-09-01",
    scheduledAt: "2026-09-01T05:00:00.000Z",
    estimatedEndAt: "2026-09-01T06:00:00.000Z",
  });
}

beforeAll(async () => {
  await seedStudio();
  await seedCustomerAndVehicle("bco-cust", "bco-veh");
});

// Full isolation: a failed test must never leak seeded jobs into the next
// one (a leftover unexpired reservation on the shared bay would fail every
// later test for the wrong reason).
afterEach(async () => {
  const all = await db.collection(COLLECTIONS.jobs()).get();
  await Promise.all(all.docs.map((d) => d.ref.delete()));
});

describe("bay physical occupancy: overdue present holders are never admitted over", () => {
  it("walk-in is refused over a >14d overdue IN_PROGRESS holder, naming the job", async () => {
    const holderId = uid("bco-old");
    await db.collection(COLLECTIONS.jobs()).doc(holderId).set(overdueHolder(holderId));
    await expect(
      createWalkinJob.run({
        data: { serviceId: SERVICE_ID, vehicleId: "bco-veh", vehicleCategory: "suv", bayId: BAY, customerId: "bco-cust", studioId: STUDIO_ID },
        auth: studioAuth(uid("staff")),
      } as never),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("check-in (advanceJobStatus) is refused over a >14d overdue IN_PROGRESS holder, naming the job without closing it", async () => {
    const holderId = uid("bco-old");
    const jobId = uid("bco-new");
    await db.collection(COLLECTIONS.jobs()).doc(holderId).set(overdueHolder(holderId));
    await db.collection(COLLECTIONS.jobs()).doc(jobId).set(jobDoc(jobId, {}));
    await expect(
      advanceJobStatus.run({ data: { jobId }, auth: studioAuth(uid("staff")) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    const holder = await db.collection(COLLECTIONS.jobs()).doc(holderId).get();
    expect(holder.data()?.status).toBe("IN_PROGRESS"); // never auto-closed
    const j = await db.collection(COLLECTIONS.jobs()).doc(jobId).get();
    expect(j.data()?.status).toBe("PENDING_VEHICLE");
  });

  it("assignBay refuses to move a present job into a bay held by an overdue active job", async () => {
    const holderId = uid("bco-old");
    const jobId = uid("bco-new");
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    await db.collection(COLLECTIONS.jobs()).doc(holderId).set(overdueHolder(holderId));
    await db.collection(COLLECTIONS.jobs()).doc(jobId).set(
      jobDoc(jobId, {
        bayId: "",
        scheduledDate: today,
        scheduledAt: new Date(now.getTime() - 30 * 60000).toISOString(),
        estimatedEndAt: new Date(now.getTime() + 30 * 60000).toISOString(),
      }),
    );
    await expect(
      assignBay.run({ data: { jobId, bayId: BAY }, auth: studioAuth(uid("staff")) } as never),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("future reservation overlap is still honoured (window logic retained)", async () => {
    const resId = uid("bco-res");
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Reservation holding right now for the next 3 hours.
    await db.collection(COLLECTIONS.jobs()).doc(resId).set(
      jobDoc(resId, {
        status: "PENDING_VEHICLE",
        scheduledDate: today,
        scheduledAt: new Date(now.getTime() - 30 * 60000).toISOString(),
        estimatedEndAt: new Date(now.getTime() + 180 * 60000).toISOString(),
      }),
    );
    await expect(
      createWalkinJob.run({
        data: { serviceId: SERVICE_ID, vehicleId: "bco-veh", vehicleCategory: "suv", bayId: BAY, customerId: "bco-cust", studioId: STUDIO_ID },
        auth: studioAuth(uid("staff")),
      } as never),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });
});

describe("check-in vs scheduled reservations (real emulator)", () => {
  it("on-time check-in succeeds while a later non-overlapping booking shares the bay", async () => {
    const aId = uid("bco-a");
    const laterId = uid("bco-later");
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    await db.collection(COLLECTIONS.jobs()).doc(aId).set(
      jobDoc(aId, {
        scheduledDate: today,
        scheduledAt: new Date(now - 10 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 50 * 60000).toISOString(),
      }),
    );
    // Later booking starts 2h out: clear of this job's effective occupancy
    // (60 min from now) plus the 15-min turnover buffer.
    await db.collection(COLLECTIONS.jobs()).doc(laterId).set(
      jobDoc(laterId, {
        scheduledDate: today,
        scheduledAt: new Date(now + 120 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 180 * 60000).toISOString(),
      }),
    );
    const res = (await advanceJobStatus.run({ data: { jobId: aId }, auth: studioAuth(uid("staff")) } as never)) as {
      newStatus: string;
    };
    expect(res.newStatus).toBe("VEHICLE_RECEIVED");
  });

  it("check-in is refused over an overlapping unexpired pending reservation", async () => {
    const aId = uid("bco-a");
    const nextId = uid("bco-next");
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    await db.collection(COLLECTIONS.jobs()).doc(aId).set(
      jobDoc(aId, {
        scheduledDate: today,
        scheduledAt: new Date(now - 10 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 50 * 60000).toISOString(),
      }),
    );
    await db.collection(COLLECTIONS.jobs()).doc(nextId).set(
      jobDoc(nextId, {
        scheduledDate: today,
        scheduledAt: new Date(now + 20 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 80 * 60000).toISOString(),
      }),
    );
    await expect(
      advanceJobStatus.run({ data: { jobId: aId }, auth: studioAuth(uid("staff")) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("an expired no-show reservation does not block check-in even when windows overlap", async () => {
    const aId = uid("bco-a");
    const goneId = uid("bco-gone");
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    await db.collection(COLLECTIONS.jobs()).doc(aId).set(
      jobDoc(aId, {
        scheduledDate: today,
        scheduledAt: new Date(now - 10 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 50 * 60000).toISOString(),
      }),
    );
    await db.collection(COLLECTIONS.jobs()).doc(goneId).set(
      jobDoc(goneId, {
        scheduledDate: today,
        scheduledAt: new Date(now - 90 * 60000).toISOString(),
        estimatedEndAt: new Date(now - 30 * 60000).toISOString(),
      }),
    );
    const res = (await advanceJobStatus.run({ data: { jobId: aId }, auth: studioAuth(uid("staff")) } as never)) as {
      newStatus: string;
    };
    expect(res.newStatus).toBe("VEHICLE_RECEIVED");
  });
});

describe("late check-in actual occupancy (real emulator)", () => {
  it("late check-in within its window is refused when the actual service would collide with a future reservation", async () => {
    const aId = uid("bco-a");
    const nextId = uid("bco-next");
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    // Stale window ends in 10 min and would not overlap the reservation;
    // the 120-minute service starting now actually occupies the bay for
    // two more hours and must block.
    await db.collection(COLLECTIONS.jobs()).doc(aId).set(
      jobDoc(aId, {
        scheduledDate: today,
        scheduledAt: new Date(now - 50 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 10 * 60000).toISOString(),
        estimatedDurationMinutes: 120,
      }),
    );
    await db.collection(COLLECTIONS.jobs()).doc(nextId).set(
      jobDoc(nextId, {
        scheduledDate: today,
        scheduledAt: new Date(now + 60 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 120 * 60000).toISOString(),
      }),
    );
    await expect(
      advanceJobStatus.run({ data: { jobId: aId }, auth: studioAuth(uid("staff")) } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.collection(COLLECTIONS.jobs()).doc(aId).get()).data()?.status).toBe("PENDING_VEHICLE");
  });
});

describe("concurrent same-bay check-in (bayLocks write serialization)", () => {
  it("two simultaneous check-ins for one bay with non-overlapping windows: exactly one wins", async () => {
    // Both jobs are booked LATER today (3h/4h out) and both attempt an
    // early check-in now. Neither pending reservation overlaps the other's
    // effective occupancy window [now, now+duration+buffer], so both
    // transactions pass the holder query and genuinely race to commit
    // VEHICLE_RECEIVED plus the bayLocks write; the conflicted loser
    // retries into the winner's committed physically-present holder.
    // (A pending job whose window covers NOW always overlaps any other
    // early check-in's effective occupancy, so a both-pass race is only
    // constructible with two future-window jobs.) In every interleaving:
    // exactly one admission, never two.
    for (let round = 0; round < 3; round++) {
      const aId = uid("bco-a");
      const bId = uid("bco-b");
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      await db.collection(COLLECTIONS.jobs()).doc(aId).set(
        jobDoc(aId, {
          scheduledDate: today,
          scheduledAt: new Date(now + 180 * 60000).toISOString(),
          estimatedEndAt: new Date(now + 240 * 60000).toISOString(),
        }),
      );
      await db.collection(COLLECTIONS.jobs()).doc(bId).set(
        jobDoc(bId, {
          scheduledDate: today,
          scheduledAt: new Date(now + 300 * 60000).toISOString(),
          estimatedEndAt: new Date(now + 360 * 60000).toISOString(),
        }),
      );

      const results = await Promise.allSettled([
        advanceJobStatus.run({ data: { jobId: aId }, auth: studioAuth(uid("staff")) } as never),
        advanceJobStatus.run({ data: { jobId: bId }, auth: studioAuth(uid("staff")) } as never),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect((loser.reason as { code?: string }).code).toBe("failed-precondition");

      const a = (await db.collection(COLLECTIONS.jobs()).doc(aId).get()).data();
      const b = (await db.collection(COLLECTIONS.jobs()).doc(bId).get()).data();
      expect([a?.status, b?.status].sort()).toEqual(["PENDING_VEHICLE", "VEHICLE_RECEIVED"]);

      // Free the bay for the next round.
      await db.collection(COLLECTIONS.jobs()).doc(aId).delete();
      await db.collection(COLLECTIONS.jobs()).doc(bId).delete();
    }
  }, 60000);

  it("two simultaneous check-ins for one OVERLAPPING double-booked bay: fail closed, zero admissions", async () => {
    // Genuine double-booking: each sees the other's overlapping unexpired
    // pending reservation and refuses. Never a crash, never a partial write;
    // staff resolve by reassigning or closing one job.
    const aId = uid("bco-a");
    const bId = uid("bco-b");
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const windowJob = (id: string) =>
      jobDoc(id, {
        scheduledDate: today,
        scheduledAt: new Date(now - 10 * 60000).toISOString(),
        estimatedEndAt: new Date(now + 50 * 60000).toISOString(),
      });
    await db.collection(COLLECTIONS.jobs()).doc(aId).set(windowJob(aId));
    await db.collection(COLLECTIONS.jobs()).doc(bId).set(windowJob(bId));

    const results = await Promise.allSettled([
      advanceJobStatus.run({ data: { jobId: aId }, auth: studioAuth(uid("staff")) } as never),
      advanceJobStatus.run({ data: { jobId: bId }, auth: studioAuth(uid("staff")) } as never),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(0);
    for (const r of results) {
      expect(((r as PromiseRejectedResult).reason as { code?: string }).code).toBe("failed-precondition");
    }
    expect((await db.collection(COLLECTIONS.jobs()).doc(aId).get()).data()?.status).toBe("PENDING_VEHICLE");
    expect((await db.collection(COLLECTIONS.jobs()).doc(bId).get()).data()?.status).toBe("PENDING_VEHICLE");
  });
});

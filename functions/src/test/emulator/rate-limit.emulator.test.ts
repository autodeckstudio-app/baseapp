/**
 * Emulator tests for rate limiting / abuse hardening (Phase 3D).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { enforceRateLimit } from "../../middleware/rateLimit.js";
import { createBooking } from "../../functions/booking/createBooking.js";

const db = getFirestore();

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

describe("Rate limiting middleware — direct unit-style coverage", () => {
  it("allows requests at or under the limit", async () => {
    const u = uid("rl-under");
    for (let i = 0; i < 5; i++) {
      await expect(
        enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "membership.purchase"),
      ).resolves.toBeUndefined();
    }
  });

  it("rejects once the limit is exceeded, as resource-exhausted", async () => {
    const u = uid("rl-over");
    for (let i = 0; i < 5; i++) {
      await enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "membership.purchase");
    }
    await expect(
      enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "membership.purchase"),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("resets after the window elapses (expired windows are overwritten, not deleted)", async () => {
    const u = uid("rl-reset");
    const key = `t1__${u}__membership.purchase`;
    await db
      .collection(COLLECTIONS.rateLimits())
      .doc(key)
      .set({ windowStart: Date.now() - 120_000, count: 999 });

    await expect(
      enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "membership.purchase"),
    ).resolves.toBeUndefined();

    const snap = await db.collection(COLLECTIONS.rateLimits()).doc(key).get();
    expect((snap.data() as { count: number }).count).toBe(1);
  });

  it("tracks separate users independently", async () => {
    const a = uid("rl-userA");
    const b = uid("rl-userB");
    for (let i = 0; i < 5; i++) {
      await enforceRateLimit({ uid: a, tenantId: "t1", role: "customer" }, "membership.purchase");
    }
    await expect(
      enforceRateLimit({ uid: a, tenantId: "t1", role: "customer" }, "membership.purchase"),
    ).rejects.toThrow();
    await expect(
      enforceRateLimit({ uid: b, tenantId: "t1", role: "customer" }, "membership.purchase"),
    ).resolves.toBeUndefined();
  });

  it("tracks separate actions independently for the same user", async () => {
    const u = uid("rl-actions");
    for (let i = 0; i < 5; i++) {
      await enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "membership.purchase");
    }
    await expect(
      enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "membership.purchase"),
    ).rejects.toThrow();
    await expect(
      enforceRateLimit({ uid: u, tenantId: "t1", role: "customer" }, "booking.cancel"),
    ).resolves.toBeUndefined();
  });

  it("tenants cannot share a limit even with the same uid", async () => {
    const u = uid("rl-crosstenant");
    for (let i = 0; i < 5; i++) {
      await enforceRateLimit({ uid: u, tenantId: "tenant-a", role: "customer" }, "membership.purchase");
    }
    await expect(
      enforceRateLimit({ uid: u, tenantId: "tenant-a", role: "customer" }, "membership.purchase"),
    ).rejects.toThrow();
    await expect(
      enforceRateLimit({ uid: u, tenantId: "tenant-b", role: "customer" }, "membership.purchase"),
    ).resolves.toBeUndefined();
  });

  it("uses a role-appropriate, non-leaky error message", async () => {
    const uCust = uid("rl-msg-cust");
    const uStudio = uid("rl-msg-studio");
    const uAdmin = uid("rl-msg-admin");
    for (let i = 0; i < 5; i++) await enforceRateLimit({ uid: uCust, tenantId: "t1", role: "customer" }, "membership.purchase");
    for (let i = 0; i < 5; i++) await enforceRateLimit({ uid: uStudio, tenantId: "t1", role: "studio" }, "membership.purchase");
    for (let i = 0; i < 5; i++) await enforceRateLimit({ uid: uAdmin, tenantId: "t1", role: "admin" }, "membership.purchase");

    await expect(
      enforceRateLimit({ uid: uCust, tenantId: "t1", role: "customer" }, "membership.purchase"),
    ).rejects.toThrow(/Too many attempts\. Please wait and try again\./);
    await expect(
      enforceRateLimit({ uid: uStudio, tenantId: "t1", role: "studio" }, "membership.purchase"),
    ).rejects.toThrow(/Too many attempts\. Please wait before trying again\./);
    await expect(
      enforceRateLimit({ uid: uAdmin, tenantId: "t1", role: "admin" }, "membership.purchase"),
    ).rejects.toThrow(/Too many requests\. Please try again shortly\./);

    // No internal counters, doc IDs, or implementation details leaked.
    try {
      await enforceRateLimit({ uid: uCust, tenantId: "t1", role: "customer" }, "membership.purchase");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      expect(message).not.toMatch(/rateLimits|windowStart|count:|t1__/);
    }
  });
});

describe("Rate limiting integration with real Cloud Functions", () => {
  const TENANT_ID = "ratelimit-tenant";
  const STUDIO_ID = "ratelimit-studio";
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;
  let dayOffset = 3;

  function nextDate(): string {
    dayOffset += 1;
    return new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
  }

  function customerAuth(authUid: string) {
    return { uid: authUid, token: { role: "customer", tenantId: TENANT_ID, studioId: null }, rawToken: "test" };
  }

  beforeAll(async () => {
    const studioConfig: StudioConfig = {
      id: STUDIO_ID,
      tenantId: TENANT_ID,
      studioId: STUDIO_ID,
      name: "Rate Limit Test Studio",
      timezone: "Asia/Kolkata",
      currency: "INR",
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      operatingHours: [],
      holidays: [],
      vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
      slotIntervalMinutes: 30,
      maxAdvanceBookingDays: 60,
      cancellationWindowHours: 24,
      bays: Array.from({ length: 15 }, (_, i) => ({
        id: `${STUDIO_ID}-wash-${i + 1}`,
        tenantId: TENANT_ID,
        studioId: STUDIO_ID,
        name: `Wash Bay ${i + 1}`,
        bayType: "wash" as const,
        active: true,
      })),
      updatedAt: new Date().toISOString(),
    };
    await db.collection("studioConfig").doc(STUDIO_ID).set(studioConfig);

    const now = new Date().toISOString();
    service = {
      id: uid("svc-wash"),
      tenantId: TENANT_ID,
      name: "Rate Limit Test Wash",
      category: "washing",
      brand: null,
      description: "Test service",
      basePrice: 40000,
      currency: "INR",
      estimatedDurationMinutes: 20,
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
    await db.collection("services").doc(service.id).set(service);

    customerId = uid("cust");
    vehicle = {
      id: uid("veh"),
      tenantId: TENANT_ID,
      ownerId: customerId,
      registrationNumber: "GJ01RL0001",
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
    await db.collection("vehicles").doc(vehicle.id).set(vehicle);
  });

  async function seedVehicleFor(ownerId: string): Promise<Vehicle> {
    const now = new Date().toISOString();
    const v: Vehicle = {
      id: uid("veh"),
      tenantId: TENANT_ID,
      ownerId,
      registrationNumber: "GJ01RL" + Math.random().toString().slice(2, 6),
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
    await db.collection("vehicles").doc(v.id).set(v);
    return v;
  }

  it("blocks the 11th booking.create attempt in a window without partially mutating state", async () => {
    const before = (
      await db.collection(COLLECTIONS.bookings()).where("customerId", "==", customerId).get()
    ).size;

    for (let i = 0; i < 10; i++) {
      await createBooking.run({
        data: {
          serviceId: service.id,
          vehicleId: vehicle.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: nextDate(),
          scheduledTime: "10:00",
          idempotencyKey: uid("idem"),
        },
        auth: customerAuth(customerId),
      } as never);
    }

    await expect(
      createBooking.run({
        data: {
          serviceId: service.id,
          vehicleId: vehicle.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: nextDate(),
          scheduledTime: "10:00",
          idempotencyKey: uid("idem"),
        },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toMatchObject({ code: "resource-exhausted" });

    const after = (
      await db.collection(COLLECTIONS.bookings()).where("customerId", "==", customerId).get()
    ).size;
    // Exactly 10 successful creates landed — the rejected 11th call never
    // reached createBooking's own transaction, so it wrote nothing.
    expect(after - before).toBe(10);
  });

  it("a retry with the same idempotencyKey after success stays safe (no duplicate booking)", async () => {
    const freshCustomer = uid("cust-idem");
    const freshVehicle = await seedVehicleFor(freshCustomer);
    const idempotencyKey = uid("idem-retry");
    const scheduledDate = nextDate();

    const first = (await createBooking.run({
      data: {
        serviceId: service.id,
        vehicleId: freshVehicle.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate,
        scheduledTime: "11:00",
        idempotencyKey,
      },
      auth: customerAuth(freshCustomer),
    } as never)) as { booking: Booking };

    const retry = (await createBooking.run({
      data: {
        serviceId: service.id,
        vehicleId: freshVehicle.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate,
        scheduledTime: "11:00",
        idempotencyKey,
      },
      auth: customerAuth(freshCustomer),
    } as never)) as { booking: Booking };

    expect(retry.booking.id).toBe(first.booking.id);
    const count = (
      await db.collection(COLLECTIONS.bookings()).where("customerId", "==", freshCustomer).get()
    ).size;
    expect(count).toBe(1);
  });

  it("unauthenticated requests remain denied regardless of rate limiting", async () => {
    const freshCustomer = uid("cust-unauth");
    const freshVehicle = await seedVehicleFor(freshCustomer);
    await expect(
      createBooking.run({
        data: {
          serviceId: service.id,
          vehicleId: freshVehicle.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: nextDate(),
          scheduledTime: "12:00",
          idempotencyKey: uid("idem"),
        },
        auth: null,
      } as never),
    ).rejects.toThrow(/Authentication required/);
  });

  it("a fresh customer under the limit can still book normally", async () => {
    const freshCustomer = uid("cust-normal");
    const freshVehicle = await seedVehicleFor(freshCustomer);
    const result = (await createBooking.run({
      data: {
        serviceId: service.id,
        vehicleId: freshVehicle.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "13:00",
        idempotencyKey: uid("idem"),
      },
      auth: customerAuth(freshCustomer),
    } as never)) as { booking: Booking };

    expect(result.booking.status).toBe("CONFIRMED");
  });
});

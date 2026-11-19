/**
 * Emulator integration tests for plan-snapshotted wash service binding.
 * Owner-approved ladder (18 Nov 2026, kept 19 Nov): all membership washes
 * are Regular Wash. New plans bind washes to explicit service ids, snapshotted
 * at purchase; legacy memberships (no binding) keep the global
 * membershipWashEligible behavior unchanged.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Membership, Booking } from "@autodeck/core";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createMembershipPlan } from "../../functions/membership/createMembershipPlan.js";
import { updateMembershipPlan } from "../../functions/membership/updateMembershipPlan.js";
import { purchaseMembership } from "../../functions/membership/purchaseMembership.js";
import { activateMembership } from "../../functions/membership/activateMembership.js";
import { createBooking } from "../helpers/paid-advance-booking.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";

const db = getFirestore();

const TENANT = "binding-tenant";
const STUDIO_ID = "binding-studio";

function customerAuth(authUid: string) {
  return { uid: authUid, token: { role: "customer", tenantId: TENANT, studioId: null }, rawToken: "test" };
}
function adminAuth(authUid: string) {
  return { uid: authUid, token: { role: "admin", tenantId: TENANT, studioId: null }, rawToken: "test" };
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
    name: "Binding Test Studio",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    operatingHours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d as 0 | 1 | 2 | 3 | 4 | 5 | 6, open: "09:00", close: "19:00", closed: false })),
    holidays: [],
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30,
    maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: Array.from({ length: 10 }, (_, i) => ({
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

async function seedService(serviceId: string, name: string, basePrice: number) {
  const now = new Date().toISOString();
  // BOTH services carry membershipWashEligible=true: the global flag must NOT
  // decide coverage for bound memberships, and MUST still decide for legacy.
  const service: Service = {
    id: serviceId,
    tenantId: TENANT,
    name,
    category: "washing",
    brand: null,
    description: "Test wash service",
    basePrice,
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

async function seedVehicleFor(vehicleId: string, ownerId: string) {
  await db.collection("customers").doc(ownerId).set({ id: ownerId, authUid: ownerId, tenantId: TENANT, deletedAt: null }, { merge: true });
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId: TENANT,
    ownerId,
    registrationNumber: "GJ01MB" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
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

async function purchaseAndActivate(customerUid: string, planId: string, adminUid: string): Promise<Membership> {
  const purchase = (await purchaseMembership.run({
    data: { planId, method: "cash", idempotencyKey: uid("idem") },
    auth: customerAuth(customerUid),
  } as never)) as { membershipId: string; paymentId: string };
  await confirmPaymentMock.run({
    data: { paymentId: purchase.paymentId, mockResult: "success" },
    auth: adminAuth(adminUid),
  } as never);
  const afterPay = await db.collection("memberships").doc(purchase.membershipId).get();
  if ((afterPay.data() as Membership).status === "pending") {
    await activateMembership.run({
      data: { membershipId: purchase.membershipId },
      auth: adminAuth(adminUid),
    } as never);
  }
  const snap = await db.collection("memberships").doc(purchase.membershipId).get();
  return snap.data() as Membership;
}

async function bookWash(customerUid: string, membershipId: string, serviceId: string, vehicleId: string) {
  return (await createBooking.run({
    data: {
      serviceId,
      vehicleId,
      vehicleCategory: "hatchback",
      studioId: STUDIO_ID,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
      membershipId,
    },
    auth: customerAuth(customerUid),
  } as never)) as { booking: Booking };
}

describe("Membership wash service binding", () => {
  let regularWash: Service;
  let washAndWax: Service;
  let adminUid: string;
  let boundPlanId: string;
  let legacyPlanId: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT);
    regularWash = await seedService(uid("svc-regular"), "Regular Wash", 60000);
    washAndWax = await seedService(uid("svc-wax"), "Wash & Wax", 120000);
    adminUid = uid("admin");

    const bound = (await createMembershipPlan.run({
      data: {
        tier: "silver",
        name: "Bound Silver",
        priceInPaise: 170000,
        includedWashes: 4,
        discountPercent: 0,
        washServiceIds: [regularWash.id],
      },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    boundPlanId = bound.plan.id;

    const legacy = (await createMembershipPlan.run({
      data: { tier: "gold", name: "Legacy Gold", priceInPaise: 240000, includedWashes: 6, discountPercent: 0 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    legacyPlanId = legacy.plan.id;
  });

  it("1. createMembershipPlan stores the binding; empty binding is rejected", async () => {
    const planDoc = await db.collection("membershipPlans").doc(boundPlanId).get();
    expect((planDoc.data() as { washServiceIds?: string[] }).washServiceIds).toEqual([regularWash.id]);

    await expect(
      createMembershipPlan.run({
        data: { tier: "starter", name: "Empty Binding", priceInPaise: 90000, includedWashes: 2, discountPercent: 0, washServiceIds: [] },
        auth: adminAuth(adminUid),
      } as never),
    ).rejects.toThrow();
  });

  it("2. purchase snapshots the binding onto the Membership", async () => {
    const cust = uid("cust-snap");
    await seedVehicleFor(uid("veh-snap"), cust);
    const membership = await purchaseAndActivate(cust, boundPlanId, adminUid);
    expect(membership.washServiceIds).toEqual([regularWash.id]);
  });

  it("3. bound membership: bound service consumes a wash, price is 0", async () => {
    const cust = uid("cust-bound-yes");
    const veh = await seedVehicleFor(uid("veh-bound-yes"), cust);
    const membership = await purchaseAndActivate(cust, boundPlanId, adminUid);

    const result = await bookWash(cust, membership.id, regularWash.id, veh.id);
    expect(result.booking.membershipWashUsed).toBe(true);
    expect(result.booking.totalAmount).toBe(0);

    const snap = await db.collection("memberships").doc(membership.id).get();
    expect((snap.data() as Membership).washesUsed).toBe(1);
  });

  it("4. bound membership: globally eligible but unlisted service is charged full price", async () => {
    const cust = uid("cust-bound-no");
    const veh = await seedVehicleFor(uid("veh-bound-no"), cust);
    const membership = await purchaseAndActivate(cust, boundPlanId, adminUid);

    // Wash & Wax still carries membershipWashEligible=true globally.
    const result = await bookWash(cust, membership.id, washAndWax.id, veh.id);
    expect(result.booking.membershipWashUsed).toBe(false);
    expect(result.booking.totalAmount).toBeGreaterThan(0);

    const snap = await db.collection("memberships").doc(membership.id).get();
    expect((snap.data() as Membership).washesUsed).toBe(0);
    const usage = await db.collection(`memberships/${membership.id}/usage`).get();
    expect(usage.empty).toBe(true);
  });

  it("5. legacy membership (no binding): global flag still covers Wash & Wax", async () => {
    const cust = uid("cust-legacy");
    const veh = await seedVehicleFor(uid("veh-legacy"), cust);
    const membership = await purchaseAndActivate(cust, legacyPlanId, adminUid);
    expect(membership.washServiceIds).toBeUndefined();

    const result = await bookWash(cust, membership.id, washAndWax.id, veh.id);
    expect(result.booking.membershipWashUsed).toBe(true);
    expect(result.booking.totalAmount).toBe(0);
  });

  it("6. malformed binding on the membership doc fails closed at booking", async () => {
    const cust = uid("cust-malformed");
    const veh = await seedVehicleFor(uid("veh-malformed"), cust);
    const membership = await purchaseAndActivate(cust, boundPlanId, adminUid);
    // Corrupt the snapshot: present but not an array.
    await db.collection("memberships").doc(membership.id).update({ washServiceIds: regularWash.id });

    const result = await bookWash(cust, membership.id, regularWash.id, veh.id);
    expect(result.booking.membershipWashUsed).toBe(false);
    expect(result.booking.totalAmount).toBeGreaterThan(0);
    const snap = await db.collection("memberships").doc(membership.id).get();
    expect((snap.data() as Membership).washesUsed).toBe(0);
  });

  it("7. updateMembershipPlan writes a binding onto an existing plan", async () => {
    await updateMembershipPlan.run({
      data: { planId: legacyPlanId, washServiceIds: [regularWash.id] },
      auth: adminAuth(adminUid),
    } as never);
    const planDoc = await db.collection("membershipPlans").doc(legacyPlanId).get();
    expect((planDoc.data() as { washServiceIds?: string[] }).washServiceIds).toEqual([regularWash.id]);

    // A purchase after the update snapshots the new binding.
    const cust = uid("cust-after-update");
    await seedVehicleFor(uid("veh-after-update"), cust);
    const membership = await purchaseAndActivate(cust, legacyPlanId, adminUid);
    expect(membership.washServiceIds).toEqual([regularWash.id]);
  });
});

/**
 * Emulator integration tests for the membership system (Phase 2B).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 *
 * These invoke the REAL exported Cloud Function handlers in-process via the
 * `.run({ data, auth } as never)` entry point — same pattern as
 * walkin-financial.emulator.test.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Membership, Payment, Booking } from "@autodeck/core";

process.env["USE_PAYMENT_MOCK"] = "true";

import { createMembershipPlan } from "../../functions/membership/createMembershipPlan.js";
import { updateMembershipPlan } from "../../functions/membership/updateMembershipPlan.js";
import { purchaseMembership } from "../../functions/membership/purchaseMembership.js";
import { activateMembership } from "../../functions/membership/activateMembership.js";
import { cancelMembership } from "../../functions/membership/cancelMembership.js";
import { getMyMemberships } from "../../functions/membership/getMyMemberships.js";
import { getMembershipUsage } from "../../functions/membership/getMembershipUsage.js";
import { expireStaleMemberships } from "../../functions/membership/expireStaleMemberships.js";
import { createBooking } from "../../functions/booking/createBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";

const db = getFirestore();

const TENANT_A = "membership-tenant-a";
const TENANT_B = "membership-tenant-b";
const STUDIO_ID = "membership-studio";
const STUDIO_ID_B = "membership-studio-b";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null }, rawToken: "test" };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null }, rawToken: "test" };
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

async function seedStudio(studioId: string, tenantId: string, bayCount = 10) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Membership Test Studio",
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
      ...Array.from({ length: bayCount }, (_, i) => ({
        id: `${studioId}-wash-${i + 1}`,
        tenantId,
        studioId,
        name: `Wash Bay ${i + 1}`,
        bayType: "wash" as const,
        active: true,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `${studioId}-general-${i + 1}`,
        tenantId,
        studioId,
        name: `General Bay ${i + 1}`,
        bayType: "general" as const,
        active: true,
      })),
    ],
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

async function seedService(
  serviceId: string,
  tenantId: string,
  opts: { basePrice: number; membershipWashEligible: boolean; requiredBayType: "wash" | "general" },
) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: opts.membershipWashEligible ? "Membership Test Wash" : "Membership Test PPF",
    category: opts.membershipWashEligible ? "washing" : "ppf",
    brand: null,
    description: "Test service",
    basePrice: opts.basePrice,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType: opts.requiredBayType,
    membershipWashEligible: opts.membershipWashEligible,
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

// Purchases + activates a membership end-to-end via the real Cloud Functions,
// returning the resulting active Membership document.
async function purchaseAndActivate(
  customerUid: string,
  planId: string,
  adminUid: string,
  tenantId = TENANT_A,
): Promise<Membership> {
  const purchaseResult = (await purchaseMembership.run({
    data: { planId, method: "cash", idempotencyKey: uid("idem") },
    auth: customerAuth(customerUid, tenantId),
  } as never)) as { membershipId: string; paymentId: string };

  await confirmPaymentMock.run({
    data: { paymentId: purchaseResult.paymentId, mockResult: "success" },
    auth: adminAuth(adminUid, tenantId),
  } as never);

  await activateMembership.run({
    data: { membershipId: purchaseResult.membershipId },
    auth: adminAuth(adminUid, tenantId),
  } as never);

  const snap = await db.collection("memberships").doc(purchaseResult.membershipId).get();
  return snap.data() as Membership;
}

describe("Membership system", () => {
  let washService: Service;
  let ppfService: Service;
  let vehicle: Vehicle;
  let customerId: string;
  let adminUid: string;
  let planId: string;

  beforeAll(async () => {
    await seedStudio(STUDIO_ID, TENANT_A);
    await seedStudio(STUDIO_ID_B, TENANT_B, 5);
    washService = await seedService(uid("svc-wash"), TENANT_A, {
      basePrice: 40000,
      membershipWashEligible: true,
      requiredBayType: "wash",
    });
    ppfService = await seedService(uid("svc-ppf"), TENANT_A, {
      basePrice: 5000000,
      membershipWashEligible: false,
      requiredBayType: "general",
    });
    customerId = uid("cust");
    vehicle = await seedVehicle(uid("veh"), TENANT_A, customerId);
    adminUid = uid("admin");

    const planResult = (await createMembershipPlan.run({
      data: { tier: "silver", name: "Silver", priceInPaise: 149900, includedWashes: 2, discountPercent: 10 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    planId = planResult.plan.id;
  });

  it("1. membership creation — admin creates a plan", async () => {
    const result = (await createMembershipPlan.run({
      data: { tier: "gold", name: "Gold", priceInPaise: 299900, includedWashes: 4, discountPercent: 15 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string; tier: string; active: boolean } };
    expect(result.plan.tier).toBe("gold");
    expect(result.plan.active).toBe(true);
  });

  it("2. membership purchase — creates a pending Membership + Payment", async () => {
    const cust = uid("cust-purchase");
    const result = (await purchaseMembership.run({
      data: { planId, method: "cash", idempotencyKey: uid("idem") },
      auth: customerAuth(cust),
    } as never)) as { membershipId: string; paymentId: string };

    const membershipSnap = await db.collection("memberships").doc(result.membershipId).get();
    const membership = membershipSnap.data() as Membership;
    expect(membership.status).toBe("pending");
    expect(membership.washesTotal).toBe(2);

    const paymentSnap = await db.collection("payments").doc(result.paymentId).get();
    const payment = paymentSnap.data() as Payment;
    expect(payment.targetType).toBe("membership");
    expect(payment.membershipId).toBe(result.membershipId);
    expect(payment.amount).toBe(149900);
    expect(payment.status).toBe("pending");
  });

  it("3. membership activation — admin activates after payment completes", async () => {
    const cust = uid("cust-activate");
    const membership = await purchaseAndActivate(cust, planId, adminUid);
    expect(membership.status).toBe("active");
    expect(membership.startDate).not.toBeNull();
    expect(membership.endDate).not.toBeNull();
    expect(membership.activatedBy).toBe(adminUid);
  });

  it("4. expiry — expireStaleMemberships flips a past-endDate active membership", async () => {
    const cust = uid("cust-expiry");
    const membership = await purchaseAndActivate(cust, planId, adminUid);

    // Force the membership into the past (simulating time passing).
    await db.collection("memberships").doc(membership.id).update({ endDate: "2020-01-01" });

    const result = (await expireStaleMemberships.run({
      data: {},
      auth: adminAuth(adminUid),
    } as never)) as { expiredCount: number };
    expect(result.expiredCount).toBeGreaterThanOrEqual(1);

    const snap = await db.collection("memberships").doc(membership.id).get();
    expect((snap.data() as Membership).status).toBe("expired");

    // Lazy enforcement also rejects booking with the now-expired membership.
    await expect(
      createBooking.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehicle.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: nextDate(),
          scheduledTime: "10:00",
          idempotencyKey: uid("idem"),
          membershipId: membership.id,
        },
        auth: customerAuth(cust),
      } as never),
    ).rejects.toThrow();
  });

  it("5. eligible service — wash-eligible booking consumes a wash credit, price is 0", async () => {
    const cust = uid("cust-eligible");
    await seedVehicle(uid("veh-eligible"), TENANT_A, cust);
    const veh = (await db.collection("vehicles").where("ownerId", "==", cust).limit(1).get()).docs[0]?.data() as Vehicle;
    const membership = await purchaseAndActivate(cust, planId, adminUid);

    const result = (await createBooking.run({
      data: {
        serviceId: washService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never)) as { booking: Booking };

    expect(result.booking.membershipWashUsed).toBe(true);
    expect(result.booking.totalAmount).toBe(0);

    const membershipSnap = await db.collection("memberships").doc(membership.id).get();
    expect((membershipSnap.data() as Membership).washesUsed).toBe(1);
  });

  it("6. ineligible service — non-wash service gets a percent discount instead", async () => {
    const cust = uid("cust-ineligible");
    const veh = await seedVehicle(uid("veh-ineligible"), TENANT_A, cust);
    const membership = await purchaseAndActivate(cust, planId, adminUid);

    const result = (await createBooking.run({
      data: {
        serviceId: ppfService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never)) as { booking: Booking };

    expect(result.booking.membershipWashUsed).toBe(false);
    expect(result.booking.membershipDiscountApplied).toBe(true);
    expect(result.booking.priceBreakdown.membershipDiscount).toBe(Math.round(5000000 * 0.1));

    const membershipSnap = await db.collection("memberships").doc(membership.id).get();
    expect((membershipSnap.data() as Membership).washesUsed).toBe(0);
  });

  it("7. usage consumption — MembershipUsage record is written for a wash redemption", async () => {
    const cust = uid("cust-usage");
    const veh = await seedVehicle(uid("veh-usage"), TENANT_A, cust);
    const membership = await purchaseAndActivate(cust, planId, adminUid);

    await createBooking.run({
      data: {
        serviceId: washService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never);

    const usageResult = (await getMembershipUsage.run({
      data: { membershipId: membership.id },
      auth: customerAuth(cust),
    } as never)) as { usage: Array<{ usageType: string; valueRedeemed: number }> };

    expect(usageResult.usage.length).toBe(1);
    expect(usageResult.usage[0]?.usageType).toBe("wash");
    expect(usageResult.usage[0]?.valueRedeemed).toBe(40000);
  });

  it("8. zero remaining usage — falls back to percent discount instead of failing", async () => {
    const cust = uid("cust-zero");
    const veh = await seedVehicle(uid("veh-zero"), TENANT_A, cust);
    const membership = await purchaseAndActivate(cust, planId, adminUid); // washesTotal = 2

    // Consume both included washes.
    for (let i = 0; i < 2; i++) {
      await createBooking.run({
        data: {
          serviceId: washService.id,
          vehicleId: veh.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: nextDate(),
          scheduledTime: "10:00",
          idempotencyKey: uid("idem"),
          membershipId: membership.id,
        },
        auth: customerAuth(cust),
      } as never);
    }

    // Third wash-eligible booking: no washes left — should succeed with a
    // percent discount rather than erroring.
    const result = (await createBooking.run({
      data: {
        serviceId: washService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never)) as { booking: Booking };

    expect(result.booking.membershipWashUsed).toBe(false);
    expect(result.booking.membershipDiscountApplied).toBe(true);
    expect(result.booking.totalAmount).toBeGreaterThan(0);

    const membershipSnap = await db.collection("memberships").doc(membership.id).get();
    expect((membershipSnap.data() as Membership).washesUsed).toBe(2); // never exceeds washesTotal
  });

  it("9. cancellation usage restoration — cancelling a wash-credit booking restores the wash", async () => {
    const cust = uid("cust-cancel-restore");
    const veh = await seedVehicle(uid("veh-cancel-restore"), TENANT_A, cust);
    const membership = await purchaseAndActivate(cust, planId, adminUid);

    const bookingResult = (await createBooking.run({
      data: {
        serviceId: washService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never)) as { booking: Booking };

    let membershipSnap = await db.collection("memberships").doc(membership.id).get();
    expect((membershipSnap.data() as Membership).washesUsed).toBe(1);

    await cancelBooking.run({
      data: { bookingId: bookingResult.booking.id, reason: "Customer changed mind" },
      auth: customerAuth(cust),
    } as never);

    membershipSnap = await db.collection("memberships").doc(membership.id).get();
    expect((membershipSnap.data() as Membership).washesUsed).toBe(0);
  });

  it("10. reschedule — membership usage is untouched by rescheduling", async () => {
    const cust = uid("cust-reschedule");
    const veh = await seedVehicle(uid("veh-reschedule"), TENANT_A, cust);
    const membership = await purchaseAndActivate(cust, planId, adminUid);

    const bookingResult = (await createBooking.run({
      data: {
        serviceId: washService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never)) as { booking: Booking };

    await rescheduleBooking.run({
      data: {
        bookingId: bookingResult.booking.id,
        newDate: nextDate(),
        newTime: "11:00",
        idempotencyKey: uid("idem"),
      },
      auth: customerAuth(cust),
    } as never);

    const membershipSnap = await db.collection("memberships").doc(membership.id).get();
    expect((membershipSnap.data() as Membership).washesUsed).toBe(1); // unchanged — not restored, not re-consumed

    const bookingSnap = await db.collection("bookings").doc(bookingResult.booking.id).get();
    expect((bookingSnap.data() as Booking).membershipWashUsed).toBe(true);
  });

  it("11. payment failure — membership purchase payment failing cancels the pending membership", async () => {
    const cust = uid("cust-payfail");
    const purchaseResult = (await purchaseMembership.run({
      data: { planId, method: "cash", idempotencyKey: uid("idem") },
      auth: customerAuth(cust),
    } as never)) as { membershipId: string; paymentId: string };

    await confirmPaymentMock.run({
      data: { paymentId: purchaseResult.paymentId, mockResult: "failure" },
      auth: adminAuth(adminUid),
    } as never);

    const membershipSnap = await db.collection("memberships").doc(purchaseResult.membershipId).get();
    const membership = membershipSnap.data() as Membership;
    expect(membership.status).toBe("cancelled");
    expect(membership.cancellationReason).toBe("payment_failed");

    const paymentSnap = await db.collection("payments").doc(purchaseResult.paymentId).get();
    expect((paymentSnap.data() as Payment).status).toBe("failed");
  });

  it("12. concurrent booking race — only one of two simultaneous bookings consumes the last wash credit", async () => {
    const cust = uid("cust-race");
    const veh = await seedVehicle(uid("veh-race"), TENANT_A, cust);

    // Custom 1-wash plan so the race is deterministic: exactly one of two
    // concurrent bookings can win the last credit.
    const planResult = (await createMembershipPlan.run({
      data: { tier: "silver", name: "Race Plan", priceInPaise: 100000, includedWashes: 1, discountPercent: 10 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    const membership = await purchaseAndActivate(cust, planResult.plan.id, adminUid);

    const raceDate = nextDate();
    const [r1, r2] = await Promise.allSettled([
      createBooking.run({
        data: {
          serviceId: washService.id,
          vehicleId: veh.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: raceDate,
          scheduledTime: "09:00",
          idempotencyKey: uid("idem-race-1"),
          membershipId: membership.id,
        },
        auth: customerAuth(cust),
      } as never),
      createBooking.run({
        data: {
          serviceId: washService.id,
          vehicleId: veh.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: raceDate,
          scheduledTime: "13:00",
          idempotencyKey: uid("idem-race-2"),
          membershipId: membership.id,
        },
        auth: customerAuth(cust),
      } as never),
    ]);

    const bookings = [r1, r2]
      .filter((r): r is PromiseFulfilledResult<{ booking: Booking }> => r.status === "fulfilled")
      .map((r) => r.value.booking);

    const washesConsumedByBookings = bookings.filter((b) => b.membershipWashUsed).length;
    const membershipSnap = await db.collection("memberships").doc(membership.id).get();
    const finalWashesUsed = (membershipSnap.data() as Membership).washesUsed;

    // Exactly one wash was consumed — never two, never negative, never exceeding total.
    expect(washesConsumedByBookings).toBe(1);
    expect(finalWashesUsed).toBe(1);
  });

  it("13. cross-customer rejection — customer B cannot use customer A's membership", async () => {
    const custA = uid("cust-a-xcust");
    const custB = uid("cust-b-xcust");
    const vehB = await seedVehicle(uid("veh-b-xcust"), TENANT_A, custB);
    const membershipA = await purchaseAndActivate(custA, planId, adminUid);

    await expect(
      createBooking.run({
        data: {
          serviceId: washService.id,
          vehicleId: vehB.id,
          vehicleCategory: "hatchback",
          studioId: STUDIO_ID,
          scheduledDate: nextDate(),
          scheduledTime: "10:00",
          idempotencyKey: uid("idem"),
          membershipId: membershipA.id,
        },
        auth: customerAuth(custB),
      } as never),
    ).rejects.toThrow();
  });

  it("14. cross-tenant rejection — a tenant-B customer cannot purchase a tenant-A plan", async () => {
    const custB = uid("cust-xtenant");
    await expect(
      purchaseMembership.run({
        data: { planId, method: "cash", idempotencyKey: uid("idem") },
        auth: customerAuth(custB, TENANT_B),
      } as never),
    ).rejects.toThrow();
  });

  it("15. historical membership immutability — editing a plan does not rewrite already-purchased memberships", async () => {
    const cust = uid("cust-immutable-plan");
    const planResult = (await createMembershipPlan.run({
      data: { tier: "gold", name: "Immutability Plan", priceInPaise: 200000, includedWashes: 3, discountPercent: 12 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    const membership = await purchaseAndActivate(cust, planResult.plan.id, adminUid);

    await updateMembershipPlan.run({
      data: { planId: planResult.plan.id, discountPercent: 50, includedWashes: 99 },
      auth: adminAuth(adminUid),
    } as never);

    const membershipSnap = await db.collection("memberships").doc(membership.id).get();
    const reloaded = membershipSnap.data() as Membership;
    expect(reloaded.discountPercent).toBe(12); // unchanged despite plan edit
    expect(reloaded.washesTotal).toBe(3); // unchanged despite plan edit
  });

  it("16. historical booking price immutability — editing a plan does not rewrite an already-priced booking", async () => {
    const cust = uid("cust-immutable-booking");
    const veh = await seedVehicle(uid("veh-immutable-booking"), TENANT_A, cust);
    const planResult = (await createMembershipPlan.run({
      data: { tier: "platinum", name: "Booking Immutability Plan", priceInPaise: 300000, includedWashes: 0, discountPercent: 20 },
      auth: adminAuth(adminUid),
    } as never)) as { plan: { id: string } };
    const membership = await purchaseAndActivate(cust, planResult.plan.id, adminUid);

    const bookingResult = (await createBooking.run({
      data: {
        serviceId: ppfService.id,
        vehicleId: veh.id,
        vehicleCategory: "hatchback",
        studioId: STUDIO_ID,
        scheduledDate: nextDate(),
        scheduledTime: "10:00",
        idempotencyKey: uid("idem"),
        membershipId: membership.id,
      },
      auth: customerAuth(cust),
    } as never)) as { booking: Booking };

    const originalDiscount = bookingResult.booking.priceBreakdown.membershipDiscount;

    await updateMembershipPlan.run({
      data: { planId: planResult.plan.id, discountPercent: 90 },
      auth: adminAuth(adminUid),
    } as never);
    await cancelMembership.run({
      data: { membershipId: membership.id, reason: "test cleanup" },
      auth: adminAuth(adminUid),
    } as never);

    const bookingSnap = await db.collection("bookings").doc(bookingResult.booking.id).get();
    const reloaded = bookingSnap.data() as Booking;
    expect(reloaded.priceBreakdown.membershipDiscount).toBe(originalDiscount);
    expect(reloaded.totalAmount).toBe(bookingResult.booking.totalAmount);
  });

  it("getMyMemberships returns the customer's full membership history", async () => {
    const cust = uid("cust-history");
    await purchaseAndActivate(cust, planId, adminUid);
    const result = (await getMyMemberships.run({
      data: {},
      auth: customerAuth(cust),
    } as never)) as { memberships: Membership[] };
    expect(result.memberships.length).toBeGreaterThanOrEqual(1);
  });
});

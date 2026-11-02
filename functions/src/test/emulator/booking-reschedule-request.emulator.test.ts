/**
 * Emulator integration tests for the premium reschedule REQUEST flow
 * (basket item 6, stage 1+2 - preview, not activated).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 * CI-gated: this suite cannot run in the worktree environment.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createBooking } from "../../functions/booking/createBooking.js";
import { requestBookingReschedule } from "../../functions/booking/requestBookingReschedule.js";
import { decideBookingRescheduleRequest } from "../../functions/booking/decideBookingRescheduleRequest.js";

const db = getFirestore();

const TENANT_A = "reschedule-request-tenant";
const STUDIO_ID = "reschedule-request-studio";

function customerAuth(authUid: string) {
  return { uid: authUid, token: { role: "customer", tenantId: TENANT_A, studioId: null }, rawToken: "test" };
}
function adminAuth(authUid: string) {
  return { uid: authUid, token: { role: "admin", tenantId: TENANT_A, studioId: STUDIO_ID }, rawToken: "test" };
}
function studioAuth(authUid: string) {
  return { uid: authUid, token: { role: "studio", tenantId: TENANT_A, studioId: STUDIO_ID }, rawToken: "test" };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

let dayOffset = 6;
function nextDate(): string {
  dayOffset += 1;
  return new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
}

async function seedStudio() {
  const studioConfig: StudioConfig = {
    id: STUDIO_ID,
    tenantId: TENANT_A,
    studioId: STUDIO_ID,
    name: "Reschedule Request Studio",
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
    bays: Array.from({ length: 2 }, (_, i) => ({
      id: `${STUDIO_ID}-prot-${i + 1}`,
      tenantId: TENANT_A,
      studioId: STUDIO_ID,
      name: `Protection Bay ${i + 1}`,
      bayType: "protection" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(STUDIO_ID).set(studioConfig);
}

async function seedPremiumService(serviceId: string) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId: TENANT_A,
    name: "Reschedule Request Ceramic",
    category: "ceramic",
    brand: null,
    description: "Test premium service",
    basePrice: 200000,
    currency: "INR",
    estimatedDurationMinutes: 120,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
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

async function seedVehicle(vehicleId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId: TENANT_A,
    ownerId,
    registrationNumber: "GJ01RQ" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
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

async function makePremiumBooking(customerUid: string, service: Service, vehicle: Vehicle) {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "hatchback",
      studioId: STUDIO_ID,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      payMode: "studio",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerUid),
  } as never)) as { booking: Booking };
  return result.booking;
}

describe("Premium reschedule request flow (preview)", () => {
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;

  beforeAll(async () => {
    await seedStudio();
    service = await seedPremiumService(uid("svc-ceramic"));
    customerId = uid("cust");
    vehicle = await seedVehicle(uid("veh"), customerId);
  });

  it("customer submits one request; it is pending and counted once", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    const result = (await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never)) as { booking: Booking };

    expect(result.booking.rescheduleRequest?.status).toBe("pending");
    expect(result.booking.rescheduleRequest?.baseScheduledAt).toBe(booking.scheduledAt);
    expect(result.booking.rescheduleRequestCount).toBe(1);
    // The booking itself has NOT moved.
    expect(result.booking.scheduledAt).toBe(booking.scheduledAt);
    expect(result.booking.status).toBe("CONFIRMED");
  });

  it("rejects a second request while one is pending", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);
    await expect(
      requestBookingReschedule.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "15:00", idempotencyKey: uid("idem") },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/already pending/);
  });

  it("same-key same-slot retry returns the existing request unchanged and counts exactly once", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    const key = uid("idem-req");
    const reqDate = nextDate();
    const first = (await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: reqDate, newTime: "14:00", idempotencyKey: key },
      auth: customerAuth(customerId),
    } as never)) as { booking: Booking };
    const second = (await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: reqDate, newTime: "14:00", idempotencyKey: key },
      auth: customerAuth(customerId),
    } as never)) as { booking: Booking };
    expect(second.booking.rescheduleRequest?.status).toBe("pending");
    expect(second.booking.rescheduleRequest?.requestedAt).toBe(first.booking.rescheduleRequest?.requestedAt);
    expect(second.booking.rescheduleRequestCount).toBe(1);
  });

  it("same-key approve retry returns the approved state unchanged and never moves twice", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    const reqDate = nextDate();
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: reqDate, newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);
    const key = uid("idem-dec");
    const admin = adminAuth(uid("admin"));
    const first = (await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: true, idempotencyKey: key },
      auth: admin,
    } as never)) as { booking: Booking };
    // Simulates a client retry after a timeout where the first call committed.
    const second = (await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: true, idempotencyKey: key },
      auth: admin,
    } as never)) as { booking: Booking };
    expect(second.booking.rescheduleRequest?.status).toBe("approved");
    expect(second.booking.rescheduleRequest?.decidedAt).toBe(first.booking.rescheduleRequest?.decidedAt);
    // Exactly one move: count and slot identical to the first decision.
    expect(second.booking.rescheduleCount).toBe(first.booking.rescheduleCount);
    expect(second.booking.scheduledAt).toBe(first.booking.scheduledAt);
    expect(second.booking.rescheduleCount).toBe(booking.rescheduleCount + 1);
  });

  it("same key with a different slot is a conflict, never silently applied", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    const key = uid("idem-req");
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: key },
      auth: customerAuth(customerId),
    } as never);
    await expect(
      requestBookingReschedule.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "16:30", idempotencyKey: key },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/already used with a different time/);
  });

  it("same-key same-value decision retry returns the decided state unchanged", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);
    const key = uid("idem-dec");
    const admin = adminAuth(uid("admin"));
    const first = (await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: false, idempotencyKey: key },
      auth: admin,
    } as never)) as { booking: Booking };
    const second = (await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: false, idempotencyKey: key },
      auth: admin,
    } as never)) as { booking: Booking };
    expect(second.booking.rescheduleRequest?.status).toBe("declined");
    expect(second.booking.rescheduleRequest?.decidedAt).toBe(first.booking.rescheduleRequest?.decidedAt);
    await expect(
      decideBookingRescheduleRequest.run({
        data: { bookingId: booking.id, approve: true, idempotencyKey: key },
        auth: admin,
      } as never),
    ).rejects.toThrow(/opposite decision/);
  });

  it("admin approval moves the booking to the requested slot, request approved, money fields untouched", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    const reqDate = nextDate();
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: reqDate, newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);

    const decided = (await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: true, idempotencyKey: uid("idem") },
      auth: adminAuth(uid("admin")),
    } as never)) as { booking: Booking };

    expect(decided.booking.scheduledDate).toBe(reqDate);
    expect(decided.booking.scheduledTime).toBe("14:00");
    expect(decided.booking.rescheduleRequest?.status).toBe("approved");
    expect(decided.booking.rescheduleRequest?.decidedBy).toBeTruthy();
    expect(decided.booking.rescheduleCount).toBe(booking.rescheduleCount + 1);
    // Money state preserved: same pay mode, same unpaid studio balance, same totals.
    expect(decided.booking.payMode).toBe(booking.payMode);
    expect(decided.booking.paymentStatus).toBe(booking.paymentStatus);
    expect(decided.booking.priceBreakdown.total).toBe(booking.priceBreakdown.total);
  });

  it("a stale second decision after approval is rejected", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);
    await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: true, idempotencyKey: uid("idem") },
      auth: adminAuth(uid("admin")),
    } as never);
    await expect(
      decideBookingRescheduleRequest.run({
        data: { bookingId: booking.id, approve: false, idempotencyKey: uid("idem") },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/already approved/);
  });

  it("admin decline keeps the booking unmoved and blocks a customer re-request", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    const originalDate = booking.scheduledDate;
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);
    const decided = (await decideBookingRescheduleRequest.run({
      data: { bookingId: booking.id, approve: false, note: "No bay that day", idempotencyKey: uid("idem") },
      auth: adminAuth(uid("admin")),
    } as never)) as { booking: Booking };

    expect(decided.booking.rescheduleRequest?.status).toBe("declined");
    expect(decided.booking.scheduledDate).toBe(originalDate);

    // One request per booking: declined still counts (strict preview reading).
    await expect(
      requestBookingReschedule.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "16:00", idempotencyKey: uid("idem") },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/already used the reschedule request/);
  });

  it("studio staff cannot decide (admin-only, stricter reading)", async () => {
    const booking = await makePremiumBooking(customerId, service, vehicle);
    await requestBookingReschedule.run({
      data: { bookingId: booking.id, newDate: nextDate(), newTime: "14:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never);
    await expect(
      decideBookingRescheduleRequest.run({
        data: { bookingId: booking.id, approve: true, idempotencyKey: uid("idem") },
        auth: studioAuth(uid("staff")),
      } as never),
    ).rejects.toThrow(/admin/);
  });
});

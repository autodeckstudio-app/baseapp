/**
 * Emulator integration tests for customer booking reschedule (Phase 3C).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 *
 * Invokes the REAL exported rescheduleBooking Cloud Function handler in-process
 * via the `.run({ data, auth } as never)` entry point — same pattern as
 * membership.emulator.test.ts / walkin-financial.emulator.test.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES } from "@autodeck/core";

import { createBooking } from "../../functions/booking/createBooking.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";

const db = getFirestore();

const TENANT_A = "reschedule-tenant-a";
const STUDIO_ID = "reschedule-studio";

function customerAuth(authUid: string) {
  return { uid: authUid, token: { role: "customer", tenantId: TENANT_A, studioId: null }, rawToken: "test" };
}

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

async function seedStudio(bayCount = 10) {
  const studioConfig: StudioConfig = {
    id: STUDIO_ID,
    tenantId: TENANT_A,
    studioId: STUDIO_ID,
    name: "Reschedule Test Studio",
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
    bays: Array.from({ length: bayCount }, (_, i) => ({
      id: `${STUDIO_ID}-wash-${i + 1}`,
      tenantId: TENANT_A,
      studioId: STUDIO_ID,
      name: `Wash Bay ${i + 1}`,
      bayType: "wash" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(STUDIO_ID).set(studioConfig);
  return studioConfig;
}

async function seedService(serviceId: string) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId: TENANT_A,
    name: "Reschedule Test Wash",
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

async function seedVehicle(vehicleId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId: TENANT_A,
    ownerId,
    registrationNumber: "GJ01RS" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
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

async function makeBooking(customerUid: string, service: Service, vehicle: Vehicle) {
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "hatchback",
      studioId: STUDIO_ID,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerUid),
  } as never)) as { booking: Booking };
  return result.booking;
}

describe("Customer booking reschedule", () => {
  let service: Service;
  let vehicle: Vehicle;
  let customerId: string;

  beforeAll(async () => {
    await seedStudio();
    service = await seedService(uid("svc-wash"));
    customerId = uid("cust");
    vehicle = await seedVehicle(uid("veh"), customerId);
  });

  it("reschedules successfully, preserving price and incrementing rescheduleCount", async () => {
    const booking = await makeBooking(customerId, service, vehicle);
    const newDate = nextDate();

    const result = (await rescheduleBooking.run({
      data: { bookingId: booking.id, newDate, newTime: "12:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never)) as { booking: Booking };

    expect(result.booking.scheduledDate).toBe(newDate);
    expect(result.booking.scheduledTime).toBe("12:00");
    expect(result.booking.rescheduleCount).toBe(1);
    expect(result.booking.priceBreakdown.total).toBe(booking.priceBreakdown.total);
    expect(result.booking.totalAmount).toBe(booking.totalAmount);
    expect(result.booking.bayId).toBeTruthy();

    const stored = (await db.collection("bookings").doc(booking.id).get()).data() as Booking;
    expect(stored.scheduledDate).toBe(newDate);
    expect(stored.rescheduleCount).toBe(1);
  });

  it("rejects reschedule within the 24h free window", async () => {
    const booking = await makeBooking(customerId, service, vehicle);
    // Force the booking's scheduledAt to be within the next 12 hours.
    const soon = new Date(Date.now() + 12 * 3600000);
    await db.collection("bookings").doc(booking.id).update({ scheduledAt: soon.toISOString() });

    await expect(
      rescheduleBooking.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "12:00", idempotencyKey: uid("idem") },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/within 24 hours/);
  });

  it("rejects reschedule once the max reschedule count is reached", async () => {
    const booking = await makeBooking(customerId, service, vehicle);
    await db.collection("bookings").doc(booking.id).update({ rescheduleCount: MAX_CUSTOMER_RESCHEDULES });

    await expect(
      rescheduleBooking.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "12:00", idempotencyKey: uid("idem") },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/Maximum reschedules/);
  });

  it("rejects reschedule for a non-CONFIRMED booking", async () => {
    const booking = await makeBooking(customerId, service, vehicle);
    await db.collection("bookings").doc(booking.id).update({ status: "CANCELLED" });

    await expect(
      rescheduleBooking.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "12:00", idempotencyKey: uid("idem") },
        auth: customerAuth(customerId),
      } as never),
    ).rejects.toThrow(/Cannot reschedule a booking with status/);
  });

  it("rejects reschedule of another customer's booking", async () => {
    const booking = await makeBooking(customerId, service, vehicle);
    const otherCustomer = uid("cust-other");

    await expect(
      rescheduleBooking.run({
        data: { bookingId: booking.id, newDate: nextDate(), newTime: "12:00", idempotencyKey: uid("idem") },
        auth: customerAuth(otherCustomer),
      } as never),
    ).rejects.toThrow(/Cannot reschedule another customer's booking/);
  });
});

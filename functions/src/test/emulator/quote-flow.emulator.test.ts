/**
 * Emulator integration tests for multi-day service scheduling (Phase 5 Part 2).
 *
 * A PPF/ceramic-scale service can take multiple working days to complete.
 * These tests prove the end-to-end engine — computeScheduleEnd (pure lib),
 * the widened bay-occupancy range queries, and the per-day capacity gate in
 * generateDaySlots — behaves correctly through the real Cloud Functions
 * (createBooking, rescheduleBooking, createWalkinJob, getAvailability,
 * cancelBooking, updateService), not just at the pure-function level (see
 * src/test/unit/availability.test.ts for those).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, Customer } from "@autodeck/core";

import { createBooking } from "../../functions/booking/createBooking.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { getAvailability } from "../../functions/booking/getAvailability.js";
import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { setBookingQuote } from "../../functions/booking/setBookingQuote.js";
import { respondToBookingQuote } from "../../functions/booking/respondToBookingQuote.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";

const db = getFirestore();

const TENANT_A = "quote-tenant-a";
const TENANT_B = "quote-tenant-b";
const STUDIO_A = "quote-studio-a";

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null } };
}
function studioAuth(authUid: string, tenantId = TENANT_A, studioId = STUDIO_A) {
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

// Deterministic future date landing on a specific UTC-noon-anchored weekday
// (0=Sun..6=Sat) — matches how functions/src/lib/schedule.ts derives
// day-of-week, so tests are independent of the machine's local timezone.
function dateWithDow(targetDow: number, minDaysOut: number): string {
  let d = new Date(Date.now() + minDaysOut * 86400000);
  let dateStr = d.toISOString().slice(0, 10);
  while (new Date(`${dateStr}T12:00:00Z`).getUTCDay() !== targetDow) {
    d = new Date(d.getTime() + 86400000);
    dateStr = d.toISOString().slice(0, 10);
  }
  return dateStr;
}
function nextMonday(minDaysOut = 5): string {
  return dateWithDow(1, minDaysOut);
}
function nextSaturday(minDaysOut = 5): string {
  return dateWithDow(6, minDaysOut);
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mon-Sat 09:00-19:00 (600 min/day), Sunday closed — same shape as the real
// seeded studio (seed.ts) and the pure computeScheduleEnd unit tests.
const WEEKLY_HOURS = [
  { dayOfWeek: 0 as const, open: "09:00", close: "19:00", closed: true },
  { dayOfWeek: 1 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 2 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 3 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 4 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 5 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 6 as const, open: "09:00", close: "19:00", closed: false },
];

async function seedStudio(
  studioId: string,
  tenantId: string,
  bayCount: number,
  holidays: string[] = [],
) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Multi-day Test Studio",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    operatingHours: WEEKLY_HOURS,
    holidays,
    vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
    slotIntervalMinutes: 30,
    maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: Array.from({ length: bayCount }, (_, i) => ({
      id: `${studioId}-bay-${i + 1}`,
      tenantId,
      studioId,
      name: `Protection Bay ${i + 1}`,
      bayType: "protection" as const,
      active: true,
    })),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

async function seedService(serviceId: string, tenantId: string, estimatedDurationMinutes: number) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Multi-day PPF Test",
    category: "ppf",
    brand: "TestBrand",
    description: "Test multi-day service",
    basePrice: 0,
    priceOnRequest: true,
    currency: "INR",
    estimatedDurationMinutes,
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

async function seedCustomer(customerId: string, tenantId: string) {
  const now = new Date().toISOString();
  const customer: Customer = {
    id: customerId,
    tenantId,
    authUid: customerId,
    name: "Multi-day Test Customer",
    phone: "+919876543210",
    notificationPrefs: { push: false, quietMode: false },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.collection("customers").doc(customerId).set(customer);
  return customer;
}

async function seedVehicle(vehicleId: string, ownerId: string, tenantId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber: "GJ01MD" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
    make: "Toyota",
    model: "Fortuner",
    year: 2023,
    color: "Black",
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

async function makeBooking(
  customerUid: string,
  service: Service,
  vehicle: Vehicle,
  studioId: string,
  scheduledDate: string,
  scheduledTime = "09:00",
  tenantId = TENANT_A,
) {
  return createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "suv",
      studioId,
      scheduledDate,
      scheduledTime,
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerUid, tenantId),
  } as never) as Promise<{ booking: Booking }>;
}


describe("Price-on-request quote flow", () => {
  it("quote requested -> blocked -> admin quotes -> customer approves -> job advances", async () => {
    const studio = await seedStudio(uid("studio-q"), TENANT_A, 2);
    const service = await seedService(uid("svc-q"), TENANT_A, 300);
    const customerId = uid("cust-q");
    await seedCustomer(customerId, TENANT_A);
    const vehicle = await seedVehicle(uid("veh"), customerId, TENANT_A);
    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, nextMonday());
    const bk = async () => (await db.collection("bookings").doc(booking.id).get()).data() as Record<string, unknown>;
    const b0 = await bk();
    console.log("QUOTE1 created", b0.quoteStatus, b0.priceOnRequest);
    expect(b0.quoteStatus).toBe("requested");
    const job = (await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get()).docs[0];
    const studioA = studioAuth(uid("staff"), TENANT_A, studio.id);
    await expect(advanceJobStatus.run({ data: { jobId: job.id }, auth: studioA } as never)).rejects.toThrow(/approve the quote/);
    console.log("QUOTE2 advance blocked before quote OK");
    await expect(respondToBookingQuote.run({ data: { bookingId: booking.id }, auth: customerAuth(customerId) } as never)).rejects.toThrow();
    console.log("QUOTE3 approve before quote rejected OK");
    await expect(setBookingQuote.run({ data: { bookingId: booking.id, basePricePaise: 700000 }, auth: customerAuth(customerId) } as never)).rejects.toThrow();
    await setBookingQuote.run({ data: { bookingId: booking.id, basePricePaise: 700000 }, auth: adminAuth(uid("adm")) } as never);
    const q = await bk();
    console.log("QUOTE4 after admin quote", q.quoteStatus, JSON.stringify(q.priceBreakdown ?? q.totalPrice ?? q.basePrice));
    expect(q.quoteStatus).toBe("quoted");
    await expect(advanceJobStatus.run({ data: { jobId: job.id }, auth: studioA } as never)).rejects.toThrow(/approve the quote/);
    await respondToBookingQuote.run({ data: { bookingId: booking.id }, auth: customerAuth(customerId) } as never);
    expect((await bk()).quoteStatus).toBe("approved");
    console.log("QUOTE5 approved");
    const r = await advanceJobStatus.run({ data: { jobId: job.id }, auth: studioA } as never);
    console.log("QUOTE6 advanced", JSON.stringify(r).slice(0, 120));
  });
});

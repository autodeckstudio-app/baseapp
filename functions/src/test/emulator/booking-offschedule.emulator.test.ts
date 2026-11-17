// Isolated demo-project regression: no live records or provider calls.
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Booking } from "@autodeck/core";

import { createBooking } from "../helpers/paid-advance-booking.js";

const db = getFirestore();
const TENANT = "custody-offsched-tenant";

function customerAuth(authUid: string) {
  return { uid: authUid, token: { role: "customer", tenantId: TENANT, studioId: null } };
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function dateWithDow(targetDow: number, minDaysOut: number): string {
  let d = new Date(Date.now() + minDaysOut * 86400000);
  let dateStr = d.toISOString().slice(0, 10);
  while (new Date(`${dateStr}T12:00:00Z`).getUTCDay() !== targetDow) {
    d = new Date(d.getTime() + 86400000);
    dateStr = d.toISOString().slice(0, 10);
  }
  return dateStr;
}
const nextDow = (dow: number) => dateWithDow(dow, 5);

const WEEKLY_HOURS = [
  { dayOfWeek: 0 as const, open: "09:00", close: "19:00", closed: true },
  { dayOfWeek: 1 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 2 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 3 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 4 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 5 as const, open: "09:00", close: "19:00", closed: false },
  { dayOfWeek: 6 as const, open: "09:00", close: "19:00", closed: false },
];

async function seedStudio(studioId: string, holidays: string[] = []) {
  const studioConfig = {
    id: studioId,
    tenantId: TENANT,
    studioId,
    name: "Custody Probe Studio",
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
    bays: [
      { id: `${studioId}-bay-1`, tenantId: TENANT, studioId, name: "Protection Bay 1", bayType: "protection" as const, active: true },
    ],
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
  return studioConfig;
}

async function seedService(serviceId: string, minutes = 60) {
  const now = new Date().toISOString();
  const service = {
    id: serviceId,
    tenantId: TENANT,
    name: "Custody Probe Service",
    category: "ppf",
    brand: "TestBrand",
    description: "probe",
    basePrice: 100000_00,
    currency: "INR",
    estimatedDurationMinutes: minutes,
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

async function seedCustomerVehicle() {
  const customerId = uid("cust");
  await db.collection("customers").doc(customerId).set({
    id: customerId, authUid: customerId, tenantId: TENANT, name: "Probe",
    phone: "+919876543210", notificationPrefs: { push: false, quietMode: false },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
  });
  const vehicleId = uid("veh");
  await db.collection("vehicles").doc(vehicleId).set({
    id: vehicleId, tenantId: TENANT, ownerId: customerId,
    registrationNumber: "GJ01MD1234", make: "Toyota", model: "Fortuner",
    year: 2023, color: "Black", category: "suv", photoUrl: null, odometer: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null,
  });
  await db.collection("memberships").doc(`prio-${customerId}`).set({
    id: `prio-${customerId}`, tenantId: TENANT, customerId: customerId,
    status: "active", prioritySlot: true, endDate: null,
  });
  return { customerId, vehicleId };
}

function bookingRequest(customerId: string, vehicleId: string, serviceId: string, studioId: string, date: string, time: string) {
  return {
    data: {
      serviceId, vehicleId, vehicleCategory: "suv", studioId,
      scheduledDate: date, scheduledTime: time, idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerId),
  } as never;
}

describe("createBooking enforces the same starts as availability", () => {
  for (const [label, time] of [["before opening", "07:00"], ["after closing", "20:30"], ["at closing", "19:00"], ["off grid", "10:07"], ["short service too late", "18:30"]]) {
    it(`rejects ${label} without persisting a booking or job`, async () => {
      const studio = await seedStudio(uid("studio"));
      const service = await seedService(uid("svc"));
      const { customerId, vehicleId } = await seedCustomerVehicle();
      await expect(createBooking.run(bookingRequest(customerId, vehicleId, service.id, studio.id, nextDow(2), time!))).rejects.toMatchObject({ code: "resource-exhausted" });
      expect((await db.collection("bookings").where("studioId", "==", studio.id).get()).empty).toBe(true);
      expect((await db.collection("jobs").where("studioId", "==", studio.id).get()).empty).toBe(true);
    });
  }
  it.each(["closed weekday", "holiday"])("rejects %s without persistence", async (kind) => {
    const date = nextDow(kind === "holiday" ? 4 : 0);
    const studio = await seedStudio(uid("studio"), kind === "holiday" ? [date] : []);
    const service = await seedService(uid("svc"));
    const { customerId, vehicleId } = await seedCustomerVehicle();
    await expect(createBooking.run(bookingRequest(customerId, vehicleId, service.id, studio.id, date, "10:00"))).rejects.toMatchObject({ code: "resource-exhausted" });
    expect((await db.collection("bookings").where("studioId", "==", studio.id).get()).empty).toBe(true);
  });
  it.each([60, 1200])("preserves an offered %i-minute service and retry identity", async (minutes) => {
    const studio = await seedStudio(uid("studio"));
    const service = await seedService(uid("svc"), minutes);
    const { customerId, vehicleId } = await seedCustomerVehicle();
    const request = bookingRequest(customerId, vehicleId, service.id, studio.id, nextDow(2), "10:00");
    const { booking } = await createBooking.run(request) as { booking: Booking };
    const retry = await createBooking.run(request) as { booking: Booking };
    expect(retry.booking.id).toBe(booking.id);
    expect(booking.scheduledTime).toBe("10:00");
    expect(booking.estimatedEndDate > booking.scheduledDate).toBe(minutes > 600);
    expect((await db.collection("bookings").where("studioId", "==", studio.id).get()).size).toBe(1);
  });
});

describe("mixed-duration visit control", () => {
  it("preserves 400+200+100 minutes across days with three distinct service lines", async () => {
    const studio = await seedStudio(uid("studio"));
    const primary = await seedService(uid("svc"), 400);
    const extra1 = await seedService(uid("svc"), 200);
    const extra2 = await seedService(uid("svc"), 100);
    const { customerId, vehicleId } = await seedCustomerVehicle();
    const req = bookingRequest(customerId, vehicleId, primary.id, studio.id, nextDow(2), "09:00") as { data: Record<string, unknown> };
    req.data["extraServiceIds"] = [extra1.id, extra2.id];
    const { booking } = await createBooking.run(req as never) as { booking: Booking & { lines: { serviceId: string; durationMinutes: number }[] } };
    expect(booking.durationMinutes).toBe(700);
    expect(booking.estimatedEndDate).toBe(nextDow(3));
    expect(booking.estimatedEndTime).toBe("10:40");
    expect(booking.lines.map(l => l.serviceId)).toEqual([primary.id, extra1.id, extra2.id]);
    expect(booking.lines.map(l => l.durationMinutes)).toEqual([400, 200, 100]);
  });
});

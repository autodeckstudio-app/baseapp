/**
 * Emulator behaviour tests for Stage D capacity rules (real handlers, real Firestore emulator):
 * - booking and availability never use a bay a vehicle is still physically in (overrun / long past its estimate);
 * - every allocation writes the bay-type lock bayLocks/{tenant}__{studio}__type__{bayType};
 * - a bay cannot be retyped or deactivated while it has an upcoming booking or a vehicle in it, and a permitted
 *   retype locks BOTH the old and the new type;
 * - arrival (check-in) writes the type lock;
 * - rescheduling never silently moves a booking into a different bay type after an Admin mapping change.
 * Emulator results prove behaviour only, not production concurrency safety.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob } from "@autodeck/core";
import { createBooking } from "../helpers/paid-advance-booking.js";
import { getAvailability } from "../../functions/booking/getAvailability.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";
import { updateService } from "../../functions/service/updateService.js";
import { upsertBay } from "../../functions/studio/upsertBay.js";
import { stageFixture as advanceJobStatus } from "./stage-fixture.js";

const db = getFirestore();
const TENANT = "btl-tenant";
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const customerAuth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
const adminAuth = (u: string) => ({ uid: u, token: { role: "admin", tenantId: TENANT, studioId: null } });
const studioAuth = (u: string, studioId: string) => ({ uid: u, token: { role: "studio", tenantId: TENANT, studioId } });
const lockId = (studioId: string, type: string) => `${TENANT}__${studioId}__type__${type}`;
const lockDoc = async (studioId: string, type: string) => (await db.collection("bayLocks").doc(lockId(studioId, type)).get()).data();
/** A date six days out (well inside the booking window). */
const futureDate = () => new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);

async function seedStudio(bays: Array<{ id: string; bayType: "wash" | "protection" | "general"; active?: boolean }>) {
  const studioId = uid("btl-studio");
  const config = {
    id: studioId, tenantId: TENANT, studioId, name: "Bay type lock studio", timezone: "Asia/Kolkata", currency: "INR",
    taxRatePercent: 18, taxDescription: "GST 18%",
    operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, open: "09:00", close: "19:00", closed: false })),
    holidays: [], vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$", slotIntervalMinutes: 30, maxAdvanceBookingDays: 30,
    cancellationWindowHours: 24,
    bays: bays.map((b) => ({ id: `${studioId}-${b.id}`, tenantId: TENANT, studioId, name: b.id, bayType: b.bayType, active: b.active ?? true })),
    updatedAt: new Date().toISOString(),
  } as unknown as StudioConfig;
  await db.collection("studioConfig").doc(studioId).set(config);
  return { studioId, bay: (id: string) => `${studioId}-${id}` };
}

async function seedService(requiredBayType: "wash" | "protection" | "general" = "protection", minutes = 120) {
  const now = new Date().toISOString();
  const service: Service = {
    id: uid("btl-svc"), tenantId: TENANT, name: "Bay lock test service", category: "ppf", brand: "TestBrand", description: "Test",
    basePrice: 10_000_00, currency: "INR", estimatedDurationMinutes: minutes, warrantyLabel: null, warrantyDurationValue: null,
    warrantyDurationUnit: null, vehicleCategoryPricing: [], requiredBayType, membershipWashEligible: false, active: true,
    displayOrder: 0, createdAt: now, updatedAt: now,
  };
  await db.collection("services").doc(service.id).set(service);
  return service;
}

async function seedCustomerVehicle() {
  const customerId = uid("btl-cust");
  const now = new Date().toISOString();
  await db.collection("customers").doc(customerId).set({ id: customerId, tenantId: TENANT, authUid: customerId, name: "Lock Test", phone: "+919876543210", notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null });
  const vehicle: Vehicle = { id: uid("btl-veh"), tenantId: TENANT, ownerId: customerId, registrationNumber: "GJ01BT" + String(seq).padStart(4, "0"), make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv", photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null };
  await db.collection("vehicles").doc(vehicle.id).set(vehicle);
  await db.collection("memberships").doc(`prio-${customerId}`).set({ id: `prio-${customerId}`, tenantId: TENANT, customerId, status: "active", prioritySlot: true, endDate: null });
  return { customerId, vehicle };
}

async function book(service: Service, studioId: string, date: string, time = "11:00") {
  const { customerId, vehicle } = await seedCustomerVehicle();
  const res = (await createBooking.run({ data: { serviceId: service.id, vehicleId: vehicle.id, vehicleCategory: "suv", studioId, scheduledDate: date, scheduledTime: time, idempotencyKey: uid("idem") }, auth: customerAuth(customerId) } as never)) as { booking: Booking };
  return { ...res, customerId };
}

/** A vehicle still physically in a bay, its estimate long past (overrun / overnight / never closed). */
async function seedPresentVehicle(studioId: string, bayId: string, serviceId: string, extra: Partial<ServiceJob> = {}) {
  const id = uid("btl-held");
  await db.collection("jobs").doc(id).set({ id, tenantId: TENANT, studioId, bookingId: null, customerId: "btl-other", vehicleId: "btl-other-veh", serviceId, bayId, assignedEmployeeId: null, status: "IN_PROGRESS", statusHistory: [], scheduledDate: "2026-09-01", scheduledAt: "2026-09-01T05:00:00.000Z", estimatedEndAt: "2026-09-01T06:00:00.000Z", estimatedDurationMinutes: 60, paymentStatus: "unpaid", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z", ...extra });
  return id;
}
const releaseReceipt = { status: "READY_FOR_DELIVERY", bayReleasedAt: "2026-09-02T10:00:00.000Z", bayReleasedBy: "staff-1" };

describe("booking and availability respect physical holds", () => {
  it("a booking skips a bay another vehicle is still physically in, long after its estimate, and writes the type lock", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }, { id: "ppf-2", bayType: "protection" }]);
    const service = await seedService();
    await seedPresentVehicle(s.studioId, s.bay("ppf-1"), service.id);
    const { booking } = await book(service, s.studioId, futureDate());
    expect(booking.bayId).toBe(s.bay("ppf-2"));
    expect((await lockDoc(s.studioId, "protection"))?.["lastAssignedAt"]).toBeTruthy();
  });

  it("with its only bay physically held, availability offers no slot and booking is refused; after the release receipt both work", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    const service = await seedService();
    const date = futureDate();
    const held = await seedPresentVehicle(s.studioId, s.bay("ppf-1"), service.id);
    const { customerId } = await seedCustomerVehicle();
    const slots = async () => ((await getAvailability.run({ data: { serviceId: service.id, studioId: s.studioId, startDate: date, lookAheadDays: 1 }, auth: customerAuth(customerId) } as never)) as { slots: unknown[] }).slots;
    expect(await slots()).toHaveLength(0);
    await expect(book(service, s.studioId, date)).rejects.toThrow(/No bays available/);
    await db.collection("jobs").doc(held).update(releaseReceipt);
    expect((await slots()).length).toBeGreaterThan(0);
    expect((await book(service, s.studioId, date)).booking.bayId).toBe(s.bay("ppf-1"));
  });
});

describe("bay retype and deactivation", () => {
  const edit = (studioId: string, bayId: string, bayType: "wash" | "protection" | "general", active: boolean, name = "Edited bay") =>
    upsertBay.run({ data: { studioId, bayId, name, bayType, active }, auth: adminAuth(uid("admin")) } as never);
  const bayTypeOf = async (studioId: string, bayId: string) => ((await db.collection("studioConfig").doc(studioId).get()).data() as StudioConfig).bays.find((b) => b.id === bayId);

  it("retyping is refused while the bay has an upcoming booking; nothing is reassigned", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    const { booking } = await book(await seedService(), s.studioId, futureDate());
    await expect(edit(s.studioId, s.bay("ppf-1"), "general", true)).rejects.toThrow(/upcoming booking or a vehicle/);
    expect((await bayTypeOf(s.studioId, s.bay("ppf-1")))?.bayType).toBe("protection");
    expect(((await db.collection("bookings").doc(booking.id).get()).data() as Booking).bayId).toBe(s.bay("ppf-1"));
  });

  it("deactivation is refused while a vehicle physically occupies the bay", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    await seedPresentVehicle(s.studioId, s.bay("ppf-1"), "any-service");
    await expect(edit(s.studioId, s.bay("ppf-1"), "protection", false)).rejects.toThrow(/upcoming booking or a vehicle/);
    expect((await bayTypeOf(s.studioId, s.bay("ppf-1")))?.active).toBe(true);
  });

  it("retyping an empty bay succeeds and locks BOTH the old and the new type in the same write", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }, { id: "ppf-2", bayType: "protection" }]);
    await seedPresentVehicle(s.studioId, s.bay("ppf-1"), "any-service"); // a different bay may be occupied
    await seedPresentVehicle(s.studioId, s.bay("ppf-2"), "any-service", { status: "PENDING_VEHICLE", scheduledAt: "2026-09-01T05:00:00.000Z", estimatedEndAt: "2026-09-01T06:00:00.000Z" }); // an expired no-show holds nothing
    await edit(s.studioId, s.bay("ppf-2"), "general", true);
    expect((await bayTypeOf(s.studioId, s.bay("ppf-2")))?.bayType).toBe("general");
    const [oldLock, newLock] = [await lockDoc(s.studioId, "protection"), await lockDoc(s.studioId, "general")];
    expect(oldLock?.["lastAssignedAt"]).toBeTruthy();
    expect(newLock?.["lastAssignedAt"]).toBe(oldLock?.["lastAssignedAt"]);
  });

  it("a name-only change on an occupied bay is not a capacity change: allowed, and no type lock is taken", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    await seedPresentVehicle(s.studioId, s.bay("ppf-1"), "any-service");
    await edit(s.studioId, s.bay("ppf-1"), "protection", true, "Renamed bay");
    expect((await bayTypeOf(s.studioId, s.bay("ppf-1")))?.name).toBe("Renamed bay");
    expect(await lockDoc(s.studioId, "protection")).toBeUndefined();
  });
});

describe("arrival", () => {
  it("checking a vehicle in writes the bay-type lock and keeps existing check-in semantics", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    const service = await seedService();
    const { customerId, vehicle } = await seedCustomerVehicle();
    const id = uid("btl-arrive");
    const start = new Date().toISOString();
    await db.collection("jobs").doc(id).set({ id, tenantId: TENANT, studioId: s.studioId, bookingId: null, customerId, vehicleId: vehicle.id, serviceId: service.id, bayId: s.bay("ppf-1"), assignedEmployeeId: null, status: "PENDING_VEHICLE", statusHistory: [], scheduledDate: start.slice(0, 10), scheduledAt: start, estimatedEndAt: new Date(Date.now() + 3_600_000).toISOString(), estimatedDurationMinutes: 60, paymentStatus: "unpaid", createdAt: start, updatedAt: start });
    await advanceJobStatus.run({ data: { jobId: id }, auth: studioAuth(uid("staff"), s.studioId) } as never);
    expect(((await db.collection("jobs").doc(id).get()).data() as ServiceJob).status).toBe("VEHICLE_RECEIVED");
    const lock = await lockDoc(s.studioId, "protection");
    expect(Date.parse(lock?.["lastAssignedAt"])).toBeGreaterThanOrEqual(Date.parse(start));
  });
});

describe("mapping changes never silently move a booking", () => {
  it("rescheduling is refused after Admin maps the service to a different bay type; the booking is unchanged", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }, { id: "gar-1", bayType: "general" }]);
    const service = await seedService("protection");
    const date = futureDate();
    const { booking, customerId } = await book(service, s.studioId, date);
    expect(booking.bayId).toBe(s.bay("ppf-1"));
    await updateService.run({ data: { serviceId: service.id, requiredBayType: "general" }, auth: adminAuth(uid("admin")) } as never);
    const newDate = new Date(Date.parse(`${date}T00:00:00.000Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
    await expect(rescheduleBooking.run({ data: { bookingId: booking.id, newDate, newTime: "11:00", idempotencyKey: uid("idem") }, auth: customerAuth(customerId) } as never)).rejects.toThrow(/no longer matches/);
    const after = (await db.collection("bookings").doc(booking.id).get()).data() as Booking;
    expect([after.bayId, after.scheduledDate]).toEqual([s.bay("ppf-1"), date]);
  });
});

describe("bayReservations: one booking holding several bays", () => {
  const reservation = (studioId: string, bayId: string, date: string, extra: Record<string, unknown> = {}) => ({
    id: `${uid("bk")}__ppf__0`, tenantId: TENANT, studioId, bookingId: uid("bk"), jobId: uid("job"), serviceId: "ppf", stageIndex: 0,
    bayId, bayType: "protection", startAt: `${date}T05:00:00.000Z`, endAt: `${date}T08:45:00.000Z`, blockedUntil: `${date}T09:00:00.000Z`,
    status: "active", createdAt: new Date().toISOString(), releasedAt: null, releasedBy: null, ...extra,
  });

  it("all reservations of a booking are created atomically: if one cannot be created, none remain", async () => {
    const { createBayReservations, BAY_RESERVATIONS } = await import("../../lib/bay-reservations.js");
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "gar-1", bayType: "general" }, { id: "ppf-1", bayType: "protection" }]);
    const date = futureDate();
    const rows = [reservation(s.studioId, s.bay("wash-1"), date), reservation(s.studioId, s.bay("gar-1"), date), reservation(s.studioId, s.bay("ppf-1"), date)];
    await db.collection(BAY_RESERVATIONS).doc(rows[2]!.id).set(rows[2]!); // the third id already exists
    await expect(db.runTransaction(async (tx) => { createBayReservations(tx, db, rows as never); })).rejects.toThrow();
    for (const r of rows.slice(0, 2)) expect((await db.collection(BAY_RESERVATIONS).doc(r.id).get()).exists).toBe(false);
  });

  it("another booking's active stage reservation blocks its bay for booking and availability; a released one does not", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    const service = await seedService();
    const date = futureDate();
    const r = reservation(s.studioId, s.bay("ppf-1"), date);
    await db.collection("bayReservations").doc(r.id).set(r);
    const { customerId } = await seedCustomerVehicle();
    const slotsAt = async (time: string) => ((await getAvailability.run({ data: { serviceId: service.id, studioId: s.studioId, startDate: date, lookAheadDays: 1 }, auth: customerAuth(customerId) } as never)) as { slots: Array<{ startTime: string }> }).slots.some((x) => x.startTime === time);
    expect(await slotsAt("11:00")).toBe(false); // 05:30Z falls inside the reserved window
    await expect(book(service, s.studioId, date, "11:00")).rejects.toThrow(/No bays available/);
    await db.collection("bayReservations").doc(r.id).update({ status: "released", releasedAt: new Date().toISOString(), releasedBy: "staff-1" });
    expect(await slotsAt("11:00")).toBe(true);
    expect((await book(service, s.studioId, date, "11:00")).booking.bayId).toBe(s.bay("ppf-1"));
  });

  it("a bay with an upcoming stage reservation cannot be retyped or deactivated", async () => {
    const s = await seedStudio([{ id: "ppf-1", bayType: "protection" }]);
    const r = reservation(s.studioId, s.bay("ppf-1"), futureDate());
    await db.collection("bayReservations").doc(r.id).set(r);
    await expect(upsertBay.run({ data: { studioId: s.studioId, bayId: s.bay("ppf-1"), name: "x", bayType: "general", active: true }, auth: adminAuth(uid("admin")) } as never)).rejects.toThrow(/upcoming booking or a vehicle/);
    await expect(upsertBay.run({ data: { studioId: s.studioId, bayId: s.bay("ppf-1"), name: "x", bayType: "protection", active: false }, auth: adminAuth(uid("admin")) } as never)).rejects.toThrow(/upcoming booking or a vehicle/);
  });
});

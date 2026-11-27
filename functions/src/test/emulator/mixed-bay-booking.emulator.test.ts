/**
 * Mixed-bay bookings (approved): one booking and one job for services needing different bay types, with one
 * bayReservation per scheduled stage, created atomically in the booking transaction (cart order, 0 transfer minutes).
 * Real handlers against the Firestore emulator (demo project). Emulator results prove behaviour only, not production
 * concurrency safety.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, PriceBreakdown } from "@autodeck/core";
import { createBooking } from "../helpers/paid-advance-booking.js";
import { getAvailability } from "../../functions/booking/getAvailability.js";
import { rescheduleBooking } from "../../functions/booking/rescheduleBooking.js";
import { cancelBooking } from "../../functions/booking/cancelBooking.js";
import { releaseCompletedBay } from "../../functions/job/releaseCompletedBay.js";
import { calculateServicePrice } from "../../functions/service/calculatePrice.js";
import { readCancelReads, writeCancelRestores } from "../../lib/cancel-booking.js";
import { joinVisit } from "../../functions/visit/joinVisit.js";
import { randomUUID } from "node:crypto";

const db = getFirestore();
const TENANT = "mixed-tenant";
let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;
const customerAuth = (u: string) => ({ uid: u, token: { role: "customer", tenantId: TENANT, studioId: null } });
const studioAuth = (u: string, studioId: string) => ({ uid: u, token: { role: "studio", tenantId: TENANT, studioId } });
const futureDate = () => new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);

async function seedStudio(bays: Array<{ id: string; bayType: "wash" | "protection" | "general" }>) {
  const studioId = uid("mixed-studio");
  await db.collection("studioConfig").doc(studioId).set({
    id: studioId, tenantId: TENANT, studioId, name: "Mixed studio", timezone: "Asia/Kolkata", currency: "INR", taxRatePercent: 18, taxDescription: "GST 18%",
    operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, open: "09:00", close: "19:00", closed: false })),
    holidays: [], vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$", slotIntervalMinutes: 30, maxAdvanceBookingDays: 30, cancellationWindowHours: 24,
    bays: bays.map((b) => ({ id: `${studioId}-${b.id}`, tenantId: TENANT, studioId, name: b.id, bayType: b.bayType, active: true })),
    updatedAt: new Date().toISOString(),
  } as unknown as StudioConfig);
  return { studioId, bay: (id: string) => `${studioId}-${id}` };
}
async function seedService(requiredBayType: "wash" | "protection" | "general", minutes: number, name: string, basePrice = 1_000_00) {
  const now = new Date().toISOString();
  const s: Service = { id: uid("mixed-svc"), tenantId: TENANT, name, category: "washing", brand: null, description: "Test", basePrice, currency: "INR", estimatedDurationMinutes: minutes, warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null, vehicleCategoryPricing: [], requiredBayType, membershipWashEligible: false, active: true, displayOrder: 0, createdAt: now, updatedAt: now };
  await db.collection("services").doc(s.id).set(s);
  return s;
}
async function seedCustomer() {
  const customerId = uid("mixed-cust"), now = new Date().toISOString();
  await db.collection("customers").doc(customerId).set({ id: customerId, tenantId: TENANT, authUid: customerId, name: "Mixed", phone: "+919876543210", notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null });
  const vehicle: Vehicle = { id: uid("mixed-veh"), tenantId: TENANT, ownerId: customerId, registrationNumber: "GJ01MX" + String(seq).padStart(4, "0"), make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv", photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null };
  await db.collection("vehicles").doc(vehicle.id).set(vehicle);
  await db.collection("memberships").doc(`prio-${customerId}`).set({ id: `prio-${customerId}`, tenantId: TENANT, customerId, status: "active", prioritySlot: true, endDate: null });
  return { customerId, vehicle };
}
async function bookCart(services: Service[], studioId: string, date: string, time = "11:00", who?: { customerId: string; vehicle: Vehicle }) {
  const c = who ?? (await seedCustomer());
  const [main, ...extras] = services;
  const res = (await createBooking.run({ data: { serviceId: main!.id, extraServiceIds: extras.map((s) => s.id), vehicleId: c.vehicle.id, vehicleCategory: "suv", studioId, scheduledDate: date, scheduledTime: time, idempotencyKey: uid("idem") }, auth: customerAuth(c.customerId) } as never)) as { booking: Booking };
  return { ...res, customerId: c.customerId };
}
const reservationsOf = async (bookingId: string) => (await db.collection("bayReservations").where("bookingId", "==", bookingId).get()).docs.map((d) => d.data()).sort((a, b) => String(a["startAt"]).localeCompare(String(b["startAt"])));
const recordsOf = async (customerId: string) => ({ bookings: (await db.collection("bookings").where("customerId", "==", customerId).get()).size, jobs: (await db.collection("jobs").where("customerId", "==", customerId).get()).size });
const slotTimes = async (serviceIds: string[], studioId: string, date: string) => {
  const c = await seedCustomer();
  const r = (await getAvailability.run({ data: { serviceId: serviceIds[0]!, extraServiceIds: serviceIds.slice(1), studioId, startDate: date, lookAheadDays: 1 }, auth: customerAuth(c.customerId) } as never)) as { slots: Array<{ startTime: string }> };
  return r.slots.map((s) => s.startTime);
};
/** Another booking's active stage reservation covering [from, to) (UTC) on a bay. */
async function reserveBay(studioId: string, bayId: string, date: string, from: string, to: string) {
  const bookingId = uid("other");
  await db.collection("bayReservations").doc(`${bookingId}__x__0`).set({ id: `${bookingId}__x__0`, tenantId: TENANT, studioId, bookingId, jobId: uid("job"), serviceId: "x", stageIndex: 0, bayId, bayType: "protection", startAt: `${date}T${from}:00.000Z`, endAt: `${date}T${to}:00.000Z`, blockedUntil: `${date}T${to}:00.000Z`, status: "active", createdAt: new Date().toISOString(), releasedAt: null, releasedBy: null });
}

describe("mixed-bay booking creation", () => {
  it("one booking and one job, one reservation per stage in cart order, including two stages of the same bay type", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }, { id: "gar-1", bayType: "general" }]);
    const [washA, ppf, washB] = [await seedService("wash", 30, "Wash A"), await seedService("protection", 120, "PPF"), await seedService("wash", 30, "Wash B")];
    const { booking, customerId } = await bookCart([washA, ppf, washB], s.studioId, futureDate());
    expect(await recordsOf(customerId)).toEqual({ bookings: 1, jobs: 1 });
    const rs = await reservationsOf(booking.id);
    expect(rs.map((r) => r["serviceId"])).toEqual([washA.id, ppf.id, washB.id]);
    expect(rs.map((r) => r["bayId"])).toEqual([s.bay("wash-1"), s.bay("ppf-1"), s.bay("wash-1")]);
    for (let i = 1; i < rs.length; i++) expect(rs[i]!["startAt"]).toBe(rs[i - 1]!["endAt"]); // 0 transfer minutes, one stage at a time
    const job = (await db.collection("jobs").where("bookingId", "==", booking.id).get()).docs[0]!.data() as ServiceJob;
    expect([job.bayId, job.lines?.length, [...(job.bayReservationIds ?? [])].sort()]).toEqual([s.bay("wash-1"), 3, rs.map((r) => r["id"]).sort()]);
    expect(booking.estimatedEndAt).toBe(rs.at(-1)!["endAt"]); // collection = scheduled main work only
  });

  it("capacity for some stages but not another rejects the whole booking and leaves nothing behind", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    await reserveBay(s.studioId, s.bay("ppf-1"), date, "06:00", "08:15"); // the PPF stage (06:00-08:00Z) collides
    const c = await seedCustomer();
    await expect(bookCart([wash, ppf], s.studioId, date, "11:00", c)).rejects.toThrow(/No bays available/);
    expect(await recordsOf(c.customerId)).toEqual({ bookings: 0, jobs: 0 });
    expect((await db.collection("bayReservations").where("studioId", "==", s.studioId).get()).size).toBe(1); // only the other booking's
  });

  it("concurrent mixed bookings competing for the only PPF Bay: exactly one wins and the loser leaves nothing", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "wash-2", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    const [a, b] = [await seedCustomer(), await seedCustomer()];
    const results = await Promise.allSettled([bookCart([wash, ppf], s.studioId, date, "11:00", a), bookCart([wash, ppf], s.studioId, date, "11:00", b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const ppfReservations = (await db.collection("bayReservations").where("studioId", "==", s.studioId).where("bayId", "==", s.bay("ppf-1")).where("status", "==", "active").get()).size;
    expect(ppfReservations).toBe(1);
    const loser = results[0]!.status === "rejected" ? a : b;
    expect(await recordsOf(loser.customerId)).toEqual({ bookings: 0, jobs: 0 });
  });
});

describe("mixed-bay availability", () => {
  it("offers a start only when every stage has a free bay of its own type", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    expect(await slotTimes([wash.id, ppf.id], s.studioId, date)).toContain("11:00");
    await reserveBay(s.studioId, s.bay("ppf-1"), date, "06:00", "08:15");
    const mixed = await slotTimes([wash.id, ppf.id], s.studioId, date);
    expect(mixed).not.toContain("11:00"); // its PPF stage would collide
    expect(mixed).toContain("14:00"); // 08:30Z: both stages fit after the reservation
    expect(await slotTimes([wash.id], s.studioId, date)).toContain("11:00"); // the Wash Bay alone is free
  });
});

describe("mixed-bay rescheduling and cancellation", () => {
  it("a mixed booking cannot be rescheduled; the studio coordinates the visit", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const date = futureDate();
    const { booking, customerId } = await bookCart([await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")], s.studioId, date);
    const newDate = new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
    await expect(rescheduleBooking.run({ data: { bookingId: booking.id, newDate, newTime: "11:00", idempotencyKey: uid("idem") }, auth: customerAuth(customerId) } as never)).rejects.toThrow(/more than one bay/);
    expect((await reservationsOf(booking.id)).every((r) => r["status"] === "active")).toBe(true);
  });

  it("cancelling the whole booking releases all its reservations, and their bays are bookable again", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    const { booking, customerId } = await bookCart([wash, ppf], s.studioId, date);
    expect(await slotTimes([wash.id, ppf.id], s.studioId, date)).not.toContain("11:00");
    await cancelBooking.run({ data: { bookingId: booking.id, reason: "test cancellation" }, auth: customerAuth(customerId) } as never);
    expect((await reservationsOf(booking.id)).map((r) => r["status"])).toEqual(["released", "released"]);
    expect(await slotTimes([wash.id, ppf.id], s.studioId, date)).toContain("11:00");
  });

  it("cancelling after the car has arrived releases future stages but keeps its physical bay until staff release it", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    const { booking, customerId } = await bookCart([wash, ppf], s.studioId, date);
    const jobRef = (await db.collection("jobs").where("bookingId", "==", booking.id).get()).docs[0]!.ref;
    await jobRef.update({ status: "VEHICLE_RECEIVED" }); // the car has arrived and is in its first-stage bay
    await cancelBooking.run({ data: { bookingId: booking.id, reason: "customer changed plans" }, auth: customerAuth(customerId) } as never);
    const job = (await jobRef.get()).data() as ServiceJob;
    expect([job.status, job.heldAfterCancel]).toEqual(["CANCELLED", true]);
    expect((await reservationsOf(booking.id)).every((r) => r["status"] === "released")).toBe(true); // future stages freed
    expect(await slotTimes([wash.id], s.studioId, date)).toHaveLength(0); // the Wash Bay is still physically held
    expect(await slotTimes([ppf.id], s.studioId, date)).toContain("11:00"); // the released PPF stage is bookable
    await releaseCompletedBay.run({ data: { jobId: job.id, confirmWorkCompleteAndBayEmpty: true }, auth: studioAuth(uid("staff"), s.studioId) } as never);
    expect(((await jobRef.get()).data() as ServiceJob).heldAfterCancel).toBe(false);
    const replay = (await releaseCompletedBay.run({ data: { jobId: job.id, confirmWorkCompleteAndBayEmpty: true }, auth: studioAuth(uid("staff"), s.studioId) } as never)) as { alreadyReleased?: boolean; bayReleasedAt: string };
    expect([replay.alreadyReleased, replay.bayReleasedAt]).toEqual([true, ((await jobRef.get()).data() as ServiceJob).bayReleasedAt]);
    const audits = (await db.collection("auditLog").where("entityId", "==", job.id).where("action", "==", "job.bay_released").get()).docs.map((d) => d.data());
    expect(audits.map((a) => (a["metadata"] as { operation?: string })?.operation)).toEqual(["release_cancelled_held_bay"]);
    expect(await slotTimes([wash.id], s.studioId, date)).toContain("11:00"); // explicit staff release frees it
  });
});

describe("releasing a bay after cancellation", () => {
  it("an ordinary cancelled job (car never arrived) cannot use the release, and another studio's staff cannot release a held bay", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    const plain = await bookCart([wash, ppf], s.studioId, date);
    await cancelBooking.run({ data: { bookingId: plain.booking.id, reason: "test cancellation" }, auth: customerAuth(plain.customerId) } as never);
    const plainRef = (await db.collection("jobs").where("bookingId", "==", plain.booking.id).get()).docs[0]!.ref;
    expect(((await plainRef.get()).data() as ServiceJob).heldAfterCancel).toBeUndefined();
    await expect(releaseCompletedBay.run({ data: { jobId: plainRef.id, confirmWorkCompleteAndBayEmpty: true }, auth: studioAuth(uid("staff"), s.studioId) } as never)).rejects.toMatchObject({ code: "failed-precondition" });
    expect(((await plainRef.get()).data() as ServiceJob).bayReleasedAt).toBeUndefined();

    const held = await bookCart([wash, ppf], s.studioId, date, "15:00");
    const heldRef = (await db.collection("jobs").where("bookingId", "==", held.booking.id).get()).docs[0]!.ref;
    await heldRef.update({ status: "VEHICLE_RECEIVED" });
    await cancelBooking.run({ data: { bookingId: held.booking.id, reason: "customer changed plans" }, auth: customerAuth(held.customerId) } as never);
    await expect(releaseCompletedBay.run({ data: { jobId: heldRef.id, confirmWorkCompleteAndBayEmpty: true }, auth: studioAuth(uid("staff"), uid("other-studio")) } as never)).rejects.toMatchObject({ code: "permission-denied" });
    expect(((await heldRef.get()).data() as ServiceJob).heldAfterCancel).toBe(true); // still held
  });
});

describe("mixed-bay price preview", () => {
  it("prices the mixed cart with ONE combined server calculation that equals what createBooking persists", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash", 499_99), await seedService("protection", 120, "PPF", 12_345_67)];
    const c = await seedCustomer();
    const preview = (await calculateServicePrice.run({ data: { serviceId: wash.id, vehicleCategory: "suv", extraServiceIds: [ppf.id], studioId: s.studioId }, auth: customerAuth(c.customerId) } as never)) as { breakdown: PriceBreakdown; durationMinutes?: number };
    const { booking } = await bookCart([wash, ppf], s.studioId, futureDate(), "11:00", c);
    expect(preview.breakdown.total).toBe(booking.priceBreakdown.total);
    expect([preview.breakdown.subtotal, preview.breakdown.tax, preview.breakdown.currency]).toEqual([booking.priceBreakdown.subtotal, booking.priceBreakdown.tax, booking.priceBreakdown.currency]);
    expect(preview.breakdown.addOns.map((a) => a.id)).toEqual([ppf.id]);
    expect(preview.durationMinutes).toBe(150);
  });

  it("refuses the same carts createBooking refuses, and keeps the single-service preview unchanged", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }]);
    const wash = await seedService("wash", 30, "Wash");
    const c = await seedCustomer();
    await expect(calculateServicePrice.run({ data: { serviceId: wash.id, vehicleCategory: "suv", extraServiceIds: [wash.id], studioId: s.studioId }, auth: customerAuth(c.customerId) } as never)).rejects.toThrow(/added once/);
    const alone = (await calculateServicePrice.run({ data: { serviceId: wash.id, vehicleCategory: "suv" }, auth: customerAuth(c.customerId) } as never)) as { breakdown: PriceBreakdown; durationMinutes?: number };
    expect([alone.breakdown.addOns.length, alone.durationMinutes]).toEqual([0, undefined]);
  });
});

describe("the shared cancel pair releases stage reservations for every whole-booking ending", () => {
  // readCancelReads/writeCancelRestores are used by customer and office cancellation (runCancel), the studio inline cancel,
  // waiting-cancel resolution, combined return, receipt-funded (offline) cancellation, unpaid-hold expiry, missed-booking
  // cancellation and visit-service cancellation. Releasing there covers all of them; ownership is per booking.
  it("releases exactly this booking's reservations, records who released them, and leaves another booking's untouched", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }]);
    const [wash, ppf] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF")];
    const date = futureDate();
    const mine = await bookCart([wash, ppf], s.studioId, date, "11:00");
    const other = await bookCart([wash, ppf], s.studioId, date, "15:00");
    await db.runTransaction(async (tx) => {
      const ref = db.collection("bookings").doc(mine.booking.id);
      const b = (await tx.get(ref)).data() as Booking;
      const reads = await readCancelReads(tx, db, b, b.id);
      expect(reads.reservations).toHaveLength(2);
      writeCancelRestores(tx, reads, b, b.id, { uid: "system-sweep", claims: { role: "admin", tenantId: TENANT, studioId: null } } as never, new Date().toISOString(), "test ending", false);
    });
    const released = await reservationsOf(mine.booking.id);
    expect(released.map((r) => [r["status"], r["releasedBy"], typeof r["releasedAt"]])).toEqual([["released", "system-sweep", "string"], ["released", "system-sweep", "string"]]);
    expect((await reservationsOf(other.booking.id)).map((r) => r["status"])).toEqual(["active", "active"]);
  });
});

describe("joining a shared visit", () => {
  it("a booking with stage reservations cannot join a shared visit; ordinary single-bay bookings of the same car still can", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }, { id: "gar-1", bayType: "general" }]);
    const [wash, ppf, acA, acB] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF"), await seedService("general", 30, "AC check"), await seedService("general", 30, "Battery check")];
    const c = await seedCustomer();
    const date = futureDate();
    const mixed = await bookCart([wash, ppf], s.studioId, date, "11:00", c);
    const a = await bookCart([acA], s.studioId, date, "15:00", c);
    const b = await bookCart([acB], s.studioId, date, "16:00", c);
    const jobOf = async (bookingId: string) => (await db.collection("jobs").where("bookingId", "==", bookingId).get()).docs[0]!.data() as ServiceJob & { visitId?: string };
    const join = async (bookingIds: string[]) => {
      const members = await Promise.all(bookingIds.map(async (id) => { const j = await jobOf(id); return { jobId: j.id, expectedUpdatedAt: j.updatedAt }; }));
      return (await joinVisit.run({ data: { operationId: randomUUID(), confirmed: true, members }, auth: studioAuth(uid("staff"), s.studioId) } as never)) as { visitId: string };
    };
    await expect(join([mixed.booking.id, a.booking.id])).rejects.toThrow("This booking uses more than one bay, so it cannot join a shared visit. The studio must coordinate it separately.");
    expect([(await jobOf(mixed.booking.id)).visitId, (await jobOf(a.booking.id)).visitId]).toEqual([undefined, undefined]);
    expect((await reservationsOf(mixed.booking.id)).every((r) => r["status"] === "active")).toBe(true);
    const joined = await join([a.booking.id, b.booking.id]);
    expect([(await jobOf(a.booking.id)).visitId, (await jobOf(b.booking.id)).visitId]).toEqual([joined.visitId, joined.visitId]);
  });
});

describe("joining a shared visit after the stage reservations were released", () => {
  it("released (historical) stage reservations never cause a stage-reservation refusal", async () => {
    const s = await seedStudio([{ id: "wash-1", bayType: "wash" }, { id: "ppf-1", bayType: "protection" }, { id: "gar-1", bayType: "general" }]);
    const [wash, ppf, ac] = [await seedService("wash", 30, "Wash"), await seedService("protection", 120, "PPF"), await seedService("general", 30, "AC check")];
    const c = await seedCustomer();
    const date = futureDate();
    const mixed = await bookCart([wash, ppf], s.studioId, date, "11:00", c);
    const plain = await bookCart([ac], s.studioId, date, "15:00", c);
    // Every stage reservation of the mixed booking is already released; its job is still live (not terminal).
    for (const d of (await db.collection("bayReservations").where("bookingId", "==", mixed.booking.id).get()).docs) await d.ref.update({ status: "released", releasedAt: new Date().toISOString(), releasedBy: "test" });
    const jobOf = async (bookingId: string) => (await db.collection("jobs").where("bookingId", "==", bookingId).get()).docs[0]!.data() as ServiceJob & { visitId?: string };
    const members = await Promise.all([mixed.booking.id, plain.booking.id].map(async (id) => { const j = await jobOf(id); return { jobId: j.id, expectedUpdatedAt: j.updatedAt }; }));
    const joined = (await joinVisit.run({ data: { operationId: randomUUID(), confirmed: true, members }, auth: studioAuth(uid("staff"), s.studioId) } as never)) as { visitId: string };
    expect([(await jobOf(mixed.booking.id)).visitId, (await jobOf(plain.booking.id)).visitId]).toEqual([joined.visitId, joined.visitId]);
  });
});

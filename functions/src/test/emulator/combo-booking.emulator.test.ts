import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { MENU_SEED } from "@autodeck/core";
import { createBooking } from "../../functions/booking/createBooking.js";
import { getAvailability } from "../../functions/booking/getAvailability.js";
// Combo = one main service plus extraServiceIds in a single createBooking call (real callable, Firestore emulator).
const db = getFirestore(); const T = "combo-tenant"; const S = "combo-studio"; let n = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++n}`;
const monday = (() => { let d = new Date(Date.now() + 6 * 86400000); while (d.getUTCDay() !== 1) d = new Date(d.getTime() + 86400000); return d.toISOString().slice(0, 10); })();
const HOURS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, open: "09:00", close: "19:00", closed: dayOfWeek === 0 }));
async function seed(serviceIds: string[], tag: string) {
  const now = new Date().toISOString(); const studio = `${S}-${tag}`;
  await db.collection("studioConfig").doc(studio).set({ id: studio, tenantId: T, studioId: studio, name: "Combo Studio", timezone: "Asia/Kolkata", currency: "INR", taxRatePercent: 18, taxDescription: "GST 18%", operatingHours: HOURS, holidays: [], vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$", slotIntervalMinutes: 30, maxAdvanceBookingDays: 30, cancellationWindowHours: 24, bays: [1, 2].map((i) => ({ id: `${studio}-bay-${i}`, tenantId: T, studioId: studio, name: `Bay ${i}`, bayType: "wash", active: true })), updatedAt: now });
  const names: Record<string, string> = { "menu-wash-exterior": "Exterior detail wash", "menu-wash-interior": "Interior deep clean" };
  for (const [i, id] of serviceIds.entries()) await db.collection("services").doc(id).set({ id, tenantId: T, name: names[id] ?? `Service ${i}`, category: "wash", brand: "x", description: "x", basePrice: 50000 + i * 10000, currency: "INR", estimatedDurationMinutes: 45 + i * 15, warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null, vehicleCategoryPricing: [], requiredBayType: "wash", membershipWashEligible: false, active: true, displayOrder: i, createdAt: now, updatedAt: now });
  const cust = uid("cust"); const veh = uid("veh");
  await db.collection("customers").doc(cust).set({ id: cust, tenantId: T, authUid: cust, name: "Combo Customer", phone: "+919876543210", notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null });
  await db.collection("vehicles").doc(veh).set({ id: veh, tenantId: T, ownerId: cust, registrationNumber: "GJ01CB" + String(n).padStart(4, "0"), make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv", photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null });
  await db.collection("memberships").doc(`prio-${cust}`).set({ id: `prio-${cust}`, tenantId: T, customerId: cust, status: "active", prioritySlot: true, endDate: null });
  return { studio, cust, veh };
}
const book = (x: { studio: string; cust: string; veh: string }, serviceId: string, extraServiceIds: string[]) =>
  createBooking.run({ data: { serviceId, extraServiceIds, vehicleId: x.veh, vehicleCategory: "suv", studioId: x.studio, scheduledDate: monday, scheduledTime: "09:00", idempotencyKey: uid("idem") }, auth: { uid: x.cust, token: { role: "customer", tenantId: T, studioId: null } } } as never) as Promise<{ booking: any }>;
const count = async (cust: string) => ({ bookings: (await db.collection("bookings").where("customerId", "==", cust).get()).size, jobs: (await db.collection("jobs").where("customerId", "==", cust).get()).size });

describe("combo booking through createBooking", () => {
  it("main + one extra: one booking, one job, extra priced and totals match", async () => {
    const x = await seed(["combo-main", "combo-extra"], "ok");
    const { booking } = await book(x, "combo-main", ["combo-extra"]);
    const pb = booking.priceBreakdown;
    expect(pb.addOns.map((a: any) => a.id)).toEqual(["combo-extra"]);
    expect(pb.subtotal).toBe(50000 + 60000);
    expect(pb.total).toBe(pb.subtotal + pb.tax);
    expect(booking.totalAmount).toBe(pb.total);
    const job = (await db.collection("jobs").where("bookingId", "==", booking.id).get()).docs[0]!.data();
    expect(job["totalAmount"]).toBe(pb.total);
    expect(await count(x.cust)).toEqual({ bookings: 1, jobs: 1 });
  });
  it("Exterior + Interior extras are refused as the Full detail bundle and write nothing", async () => {
    const x = await seed(["menu-wash-exterior", "menu-wash-interior"], "bundle");
    await expect(book(x, "menu-wash-exterior", ["menu-wash-interior"])).rejects.toMatchObject({ message: expect.stringContaining("Full detail wash") });
    expect(await count(x.cust)).toEqual({ bookings: 0, jobs: 0 });
  });
  it("the same service twice is refused and writes nothing", async () => {
    const x = await seed(["combo-main2"], "dupe");
    await expect(book(x, "combo-main2", ["combo-main2"])).rejects.toMatchObject({ code: "failed-precondition", message: "Each service can be added once." });
    expect(await count(x.cust)).toEqual({ bookings: 0, jobs: 0 });
  });
});

// The real catalogue entries, under the rules as they are now. This records current behaviour; it does not say whether the pair SHOULD overlap.
describe("Ceramic coating + Full detail wash under current rules", () => {
  const CER = "menu-coat-fireball-1", FULL = "menu-wash-full";
  async function realSeed() {
    const x = await seed(["combo-unused"], "real");
    for (const id of [CER, FULL]) {
      const m = MENU_SEED.find((e) => e.id === id)!; const now = new Date().toISOString();
      await db.collection("services").doc(id).set({ id, tenantId: T, name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, currency: "INR", estimatedDurationMinutes: m.minutes, warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null, vehicleCategoryPricing: [], requiredBayType: m.bay, membershipWashEligible: false, active: true, displayOrder: 0, createdAt: now, updatedAt: now });
    }
    const cfg = db.collection("studioConfig").doc(x.studio); const c = (await cfg.get()).data() as any;
    await cfg.update({ bays: [{ ...c.bays[0], id: `${x.studio}-w`, bayType: "wash" }, { ...c.bays[1], id: `${x.studio}-p`, bayType: "protection" }] });
    return x;
  }
  const MSG = "These services use different bays. Book them separately.";
  it("catalogue: Ceramic is 480 min on a protection bay, Full detail is 300 min on a wash bay", () => {
    expect(MENU_SEED.find((e) => e.id === CER)).toMatchObject({ minutes: 480, bay: "protection" });
    expect(MENU_SEED.find((e) => e.id === FULL)).toMatchObject({ minutes: 300, bay: "wash" });
  });
  for (const [main, extra] of [[CER, FULL], [FULL, CER]] as const) {
    it(`getAvailability and createBooking both refuse ${main} + ${extra} (different bays), no combined duration, no writes`, async () => {
      const x = await realSeed();
      await expect(getAvailability.run({ data: { serviceId: main, extraServiceIds: [extra], studioId: x.studio, startDate: monday }, auth: { uid: x.cust, token: { role: "customer", tenantId: T, studioId: null } } } as never)).rejects.toMatchObject({ code: "failed-precondition", message: MSG });
      await expect(book(x, main, [extra])).rejects.toMatchObject({ code: "failed-precondition", message: MSG });
      expect(await count(x.cust)).toEqual({ bookings: 0, jobs: 0 });
    });
  }
  it("each service alone books: the visit is one service, so no 780 min combined slot exists", async () => {
    const x = await realSeed();
    const a = await book(x, CER, []); const b = await book(x, FULL, []);
    expect(a.booking.estimatedEndTime).not.toBe(b.booking.estimatedEndTime);
    expect(await count(x.cust)).toEqual({ bookings: 2, jobs: 2 });
  });
});

// Round-7 point 15: the Full detail wash (menu-wash-full) is a fixed bundle and is booked as the primary service with NO extras.
// This is what the Customer app sends for a combo (no extraServiceIds). Current rules observed, nothing new asserted about overlap policy.
describe("Full detail wash booked as the combo itself (no extras)", () => {
  const FULL = "menu-wash-full";
  async function fullSeed(bays = 1) {
    const x = await seed(["combo-unused"], `full${bays}-${Date.now()}`);
    const m = MENU_SEED.find((e) => e.id === FULL)!; const now = new Date().toISOString();
    await db.collection("services").doc(FULL).set({ id: FULL, tenantId: T, name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, currency: "INR", estimatedDurationMinutes: m.minutes, warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null, vehicleCategoryPricing: [], requiredBayType: m.bay, membershipWashEligible: false, active: true, displayOrder: 0, createdAt: now, updatedAt: now });
    const cfg = db.collection("studioConfig").doc(x.studio); const c = (await cfg.get()).data() as any;
    await cfg.update({ bays: c.bays.slice(0, bays).map((b: any, i: number) => ({ ...b, id: `${x.studio}-w${i}`, bayType: "wash" })) });
    return x;
  }
  const authOf = (x: { cust: string }) => ({ uid: x.cust, token: { role: "customer", tenantId: T, studioId: null } });
  it("availability slot length is the bundle's own 300 min, and createBooking books it with no add-ons", async () => {
    const x = await fullSeed();
    const av: any = await getAvailability.run({ data: { serviceId: FULL, studioId: x.studio, startDate: monday }, auth: authOf(x) } as never);
    const first = av.slots.find((s: any) => s.date === monday && s.startTime === "09:00");
    expect(first).toBeTruthy();
    const mins = (Date.parse(first.estimatedEndAt) - Date.parse(first.startAt)) / 60000;
    expect(mins).toBe(300);
    const { booking } = await book(x, FULL, []);
    expect(booking.priceBreakdown.addOns).toEqual([]);
    expect(booking.priceBreakdown.basePrice).toBe(MENU_SEED.find((e) => e.id === FULL)!.rupees * 100);
    expect(booking.estimatedEndTime).toBe("14:00");
    expect(await count(x.cust)).toEqual({ bookings: 1, jobs: 1 });
  });
  it("Full detail as primary with Exterior or Interior as an extra is refused (already included), nothing written", async () => {
    const x = await fullSeed();
    for (const id of ["menu-wash-exterior", "menu-wash-interior"]) {
      const now = new Date().toISOString();
      await db.collection("services").doc(id).set({ id, tenantId: T, name: id === "menu-wash-exterior" ? "Exterior detail wash" : "Interior deep clean", category: "washing", brand: null, description: "x", basePrice: 100000, currency: "INR", estimatedDurationMinutes: 120, warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null, vehicleCategoryPricing: [], requiredBayType: "wash", membershipWashEligible: false, active: true, displayOrder: 1, createdAt: now, updatedAt: now });
      await expect(book(x, FULL, [id])).rejects.toMatchObject({ code: "failed-precondition", message: expect.stringContaining("already includes") });
    }
    expect(await count(x.cust)).toEqual({ bookings: 0, jobs: 0 });
  });
  it("a second customer asking for the same 09:00 slot on a one-bay wash studio does not get it", async () => {
    const x = await fullSeed(1);
    await book(x, FULL, []);
    const y = { ...x, cust: uid("cust2"), veh: uid("veh2") };
    const now = new Date().toISOString();
    await db.collection("customers").doc(y.cust).set({ id: y.cust, tenantId: T, authUid: y.cust, name: "C2", phone: "+919876543211", notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null });
    await db.collection("vehicles").doc(y.veh).set({ id: y.veh, tenantId: T, ownerId: y.cust, registrationNumber: "GJ01CB9999", make: "T", model: "F", year: 2023, color: "B", category: "suv", photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null });
    await db.collection("memberships").doc(`prio-${y.cust}`).set({ id: `prio-${y.cust}`, tenantId: T, customerId: y.cust, status: "active", prioritySlot: true, endDate: null });
    const av: any = await getAvailability.run({ data: { serviceId: FULL, studioId: x.studio, startDate: monday }, auth: authOf(y) } as never);
    expect(av.slots.some((s: any) => s.date === monday && s.startTime === "09:00")).toBe(false);
    await expect(book(y, FULL, [])).rejects.toMatchObject({ code: "resource-exhausted", message: "No bays available for the requested time slot. Please choose another time." });
    expect((await db.collection("bookings").where("customerId", "==", y.cust).get()).size).toBe(0);
  });
});

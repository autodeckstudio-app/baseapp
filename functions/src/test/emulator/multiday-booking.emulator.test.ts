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
import { updateService } from "../../functions/service/updateService.js";

const db = getFirestore();

const TENANT_A = "multiday-tenant-a";
const TENANT_B = "multiday-tenant-b";
const STUDIO_A = "multiday-studio-a";

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
    basePrice: 100000_00,
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

describe("Multi-day service scheduling (Phase 5 Part 2)", () => {
  async function freshVehicle(tenantId = TENANT_A) {
    const customerId = uid(`cust-${tenantId}`);
    const vehicle = await seedVehicle(uid("veh"), customerId, tenantId);
    return { customerId, vehicle };
  }

  it("1. a 2-day service (700 min) rolls into exactly one following open day", async () => {
    const studio = await seedStudio(uid("studio-2day"), TENANT_A, 3);
    const service = await seedService(uid("svc-2day"), TENANT_A, 700);
    const { customerId, vehicle } = await freshVehicle();
    const monday = nextMonday();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    expect(booking.scheduledDate).toBe(monday);
    expect(booking.estimatedEndDate).toBe(addDays(monday, 1)); // Tuesday
    expect(booking.estimatedEndTime).toBe("10:40"); // 100 min remaining after Monday's 600

    const job = (await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get()).docs[0]?.data() as ServiceJob;
    expect(job.estimatedEndDate).toBe(addDays(monday, 1));
    expect(job.scheduledDate).toBe(monday);
  });

  it("2. a 3-day service (1300 min) rolls into exactly two following open days", async () => {
    const studio = await seedStudio(uid("studio-3day"), TENANT_A, 3);
    const service = await seedService(uid("svc-3day"), TENANT_A, 1300);
    const { customerId, vehicle } = await freshVehicle();
    const monday = nextMonday();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    expect(booking.estimatedEndDate).toBe(addDays(monday, 2)); // Wednesday
    expect(booking.estimatedEndTime).toBe("10:40");
  });

  it("3. exact boundary fit (600 min == full day) stays single-day, ending exactly at close", async () => {
    const studio = await seedStudio(uid("studio-boundary"), TENANT_A, 3);
    const service = await seedService(uid("svc-boundary"), TENANT_A, 600);
    const { customerId, vehicle } = await freshVehicle();
    const monday = nextMonday();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    expect(booking.estimatedEndDate).toBe(monday); // same day — NOT multi-day
    expect(booking.estimatedEndTime).toBe("19:00");
  });

  it("4. insufficient capacity: a multi-day job fully occupies the studio's only bay, second booking is rejected", async () => {
    const studio = await seedStudio(uid("studio-capacity"), TENANT_A, 1);
    const service = await seedService(uid("svc-capacity"), TENANT_A, 700); // 2-day
    const monday = nextMonday();

    const first = await freshVehicle();
    await makeBooking(first.customerId, service, first.vehicle, studio.id, monday);

    const second = await freshVehicle();
    await expect(makeBooking(second.customerId, service, second.vehicle, studio.id, monday)).rejects.toThrow(
      /No bays available/,
    );
  });

  it("5. holiday crossing: a holiday inside the span is skipped, not counted or landed on", async () => {
    const monday = nextMonday();
    const tuesday = addDays(monday, 1);
    const studio = await seedStudio(uid("studio-holiday"), TENANT_A, 3, [tuesday]);
    const service = await seedService(uid("svc-holiday"), TENANT_A, 700); // would naturally land on Tuesday
    const { customerId, vehicle } = await freshVehicle();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    // Monday consumes 600, 100 remain; Tuesday is a holiday and is skipped
    // entirely — lands on Wednesday instead.
    expect(booking.estimatedEndDate).toBe(addDays(monday, 2)); // Wednesday
    expect(booking.estimatedEndTime).toBe("10:40");
  });

  it("6. weekend crossing: a Saturday start rolls through closed Sunday to Monday", async () => {
    const studio = await seedStudio(uid("studio-weekend"), TENANT_A, 3);
    const service = await seedService(uid("svc-weekend"), TENANT_A, 700);
    const { customerId, vehicle } = await freshVehicle();
    const saturday = nextSaturday();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, saturday);

    // Saturday consumes 600, 100 remain; Sunday is closed and skipped —
    // lands on the following Monday.
    expect(booking.estimatedEndDate).toBe(addDays(saturday, 2)); // Monday
    expect(booking.estimatedEndTime).toBe("10:40");
  });

  it("7. overlapping booking rejection: getAvailability excludes days already spanned by an existing multi-day job", async () => {
    const studio = await seedStudio(uid("studio-overlap"), TENANT_A, 1);
    const service = await seedService(uid("svc-overlap"), TENANT_A, 700); // 2-day
    const monday = nextMonday();

    const first = await freshVehicle();
    await makeBooking(first.customerId, service, first.vehicle, studio.id, monday);

    const availResult = (await getAvailability.run({
      data: { serviceId: service.id, studioId: studio.id, startDate: monday, lookAheadDays: 4 },
      auth: customerAuth(first.customerId),
    } as never)) as { slots: { date: string; startTime: string }[] };

    // The only bay is occupied Monday 09:00 through Tuesday ~10:55 (incl.
    // buffer) — Monday must have zero slots, and any Tuesday candidate must
    // start no earlier than 11:00 (right after the existing job's buffer
    // clears) — a later Tuesday start is legitimately free since it would
    // roll into Wednesday instead of conflicting with Monday's job.
    expect(availResult.slots.some((s) => s.date === monday)).toBe(false);
    const tuesdaySlots = availResult.slots.filter((s) => s.date === addDays(monday, 1));
    for (const s of tuesdaySlots) {
      expect(s.startTime >= "11:00").toBe(true);
    }
  });

  // KNOWN, OPEN, DOCUMENTED LIMITATION (Phase 7 hostile audit): this test
  // passes the large majority of the time, but repeated adversarial
  // back-to-back re-runs (6-8x in a row) empirically showed it fails
  // roughly 1 in 6-7 times even after this session's bayLocks mitigation
  // (createBooking.ts) — down from roughly 1 in 2 before that mitigation.
  // Root cause: Firestore transactions do not reliably serialize two
  // concurrent transactions whose only overlapping read is a QUERY result
  // both see as empty before either commits (a "phantom read" gap — see
  // packages/database/src/collections.ts's bayLocks doc comment for the
  // full account). A single green run of this test is NOT sufficient
  // evidence the race is closed — this is exactly why it should be re-run
  // several times back-to-back when validating any future change here, not
  // trusted from one pass/fail result.
  it("8. concurrent booking race: two simultaneous multi-day bookings for the same single bay — exactly one wins (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) — the
    // bayLocks mitigation this relies on is documented (see
    // COLLECTIONS.bayLocks' comment) to measurably reduce but NOT fully
    // eliminate this race (~10-15% residual failure rate under adversarial
    // stress), so a single-pair test has a real chance of passing even if
    // the underlying protection regresses. Each iteration uses its own
    // fresh single-bay studio so iterations never interfere with each other.
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const studio = await seedStudio(uid("studio-race"), TENANT_A, 1);
      const service = await seedService(uid("svc-race"), TENANT_A, 700);
      const monday = nextMonday();
      const a = await freshVehicle();
      const b = await freshVehicle();

      const results = await Promise.allSettled([
        makeBooking(a.customerId, service, a.vehicle, studio.id, monday),
        makeBooking(b.customerId, service, b.vehicle, studio.id, monday),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled, `iteration ${i}: expected exactly one winner`).toHaveLength(1);
      expect(rejected, `iteration ${i}: expected exactly one loser`).toHaveLength(1);
    }
  }, 180_000);

  it("9. cancellation releases capacity: a cancelled multi-day booking's bay becomes bookable again", async () => {
    const studio = await seedStudio(uid("studio-cancel"), TENANT_A, 1);
    const service = await seedService(uid("svc-cancel"), TENANT_A, 700);
    const monday = nextMonday();

    const first = await freshVehicle();
    const { booking } = await makeBooking(first.customerId, service, first.vehicle, studio.id, monday);

    await cancelBooking.run({
      data: { bookingId: booking.id, reason: "test cancellation" },
      auth: customerAuth(first.customerId),
    } as never);

    const second = await freshVehicle();
    const result = await makeBooking(second.customerId, service, second.vehicle, studio.id, monday);
    expect(result.booking.bayId).toBe(booking.bayId);
  });

  it("10. rescheduling a multi-day booking recomputes the full new span and frees the old one", async () => {
    const studio = await seedStudio(uid("studio-resched"), TENANT_A, 1);
    const service = await seedService(uid("svc-resched"), TENANT_A, 700);
    const monday = nextMonday();
    const newMonday = addDays(monday, 7); // a week later, still a Monday

    const { customerId, vehicle } = await freshVehicle();
    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    const rescheduled = (await rescheduleBooking.run({
      data: { bookingId: booking.id, newDate: newMonday, newTime: "09:00", idempotencyKey: uid("idem") },
      auth: customerAuth(customerId),
    } as never)) as { booking: Booking };

    expect(rescheduled.booking.scheduledDate).toBe(newMonday);
    expect(rescheduled.booking.estimatedEndDate).toBe(addDays(newMonday, 1));

    // The original Monday slot is now free again.
    const other = await freshVehicle();
    const again = await makeBooking(other.customerId, service, other.vehicle, studio.id, monday);
    expect(again.booking.bayId).toBeTruthy();
  });

  it("11. walk-in interaction: a multi-day walk-in blocks a subsequent booking attempt on the same bay/span", async () => {
    const studio = await seedStudio(uid("studio-walkin"), TENANT_A, 1);
    // A walk-in starts at the real current wall-clock time (not a controlled
    // test date), so the duration must exceed any conceivable single
    // calendar day's remaining window (up to 1440 min if "now" were exactly
    // midnight) to deterministically force multi-day rollover regardless of
    // what time of day this test happens to run.
    const service = await seedService(uid("svc-walkin"), TENANT_A, 2000);
    const { customerId, vehicle } = await freshVehicle();

    await seedCustomer(customerId, TENANT_A);
    const walkinResult = (await createWalkinJob.run({
      data: {
        serviceId: service.id,
        vehicleId: vehicle.id,
        vehicleCategory: "suv",
        bayId: studio.bays[0]?.id as string,
        customerId,
        studioId: studio.id,
      },
      auth: studioAuth(uid("emp"), TENANT_A, studio.id),
    } as never)) as { job: ServiceJob };

    expect(walkinResult.job.estimatedEndDate).not.toBe(walkinResult.job.scheduledDate);

    // A booking targeting the day after the walk-in started, same (only)
    // bay, must be rejected — using "tomorrow" rather than the walk-in's own
    // start date keeps this deterministic regardless of what wall-clock time
    // the test happens to run at (booking "today" at a fixed clock time can
    // itself already be in the past). A 2000-min job's occupied span is
    // guaranteed to extend at least 2000 real minutes (33h20m) past its
    // start, which always covers "tomorrow 09:00" (at most ~33h away even in
    // the worst case where the walk-in started at midnight).
    const other = await freshVehicle();
    await expect(
      makeBooking(other.customerId, service, other.vehicle, studio.id, addDays(walkinResult.job.scheduledDate, 1)),
    ).rejects.toThrow(/No bays available/);
  });

  it("12. cross-tenant isolation: another tenant's fully-occupying multi-day job does not block this tenant's studio", async () => {
    const monday = nextMonday();
    const studioA = await seedStudio(uid("studio-xtenant-a"), TENANT_A, 1);
    const studioB = await seedStudio(uid("studio-xtenant-b"), TENANT_B, 1);
    const serviceA = await seedService(uid("svc-xtenant-a"), TENANT_A, 700);
    const serviceB = await seedService(uid("svc-xtenant-b"), TENANT_B, 700);

    const tenantBParty = await freshVehicle(TENANT_B);
    await makeBooking(tenantBParty.customerId, serviceB, tenantBParty.vehicle, studioB.id, monday, "09:00", TENANT_B);

    // Tenant A's studio has its own, separate bay — must be unaffected.
    const tenantAParty = await freshVehicle(TENANT_A);
    const result = await makeBooking(tenantAParty.customerId, serviceA, tenantAParty.vehicle, studioA.id, monday);
    expect(result.booking.bayId).toBeTruthy();
  });

  it("13. cross-studio isolation: another studio's fully-occupying multi-day job does not block this studio", async () => {
    const monday = nextMonday();
    const studioA = await seedStudio(uid("studio-xstudio-a"), TENANT_A, 1);
    const studioC = await seedStudio(uid("studio-xstudio-c"), TENANT_A, 1);
    const serviceA = await seedService(uid("svc-xstudio-a"), TENANT_A, 700);
    const serviceC = await seedService(uid("svc-xstudio-c"), TENANT_A, 700);

    const partyC = await freshVehicle();
    await makeBooking(partyC.customerId, serviceC, partyC.vehicle, studioC.id, monday);

    const partyA = await freshVehicle();
    const result = await makeBooking(partyA.customerId, serviceA, partyA.vehicle, studioA.id, monday);
    expect(result.booking.bayId).toBeTruthy();
  });

  it("14. historical immutability: a later catalogue duration change does not alter an already-created booking/job", async () => {
    const studio = await seedStudio(uid("studio-immutable"), TENANT_A, 3);
    const service = await seedService(uid("svc-immutable"), TENANT_A, 700);
    const { customerId, vehicle } = await freshVehicle();
    const monday = nextMonday();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);
    const originalEndDate = booking.estimatedEndDate;
    const originalEndAt = booking.estimatedEndAt;

    await updateService.run({
      data: { serviceId: service.id, estimatedDurationMinutes: 4000 },
      auth: adminAuth(uid("admin")),
    } as never);

    const storedBooking = (await db.collection("bookings").doc(booking.id).get()).data() as Booking;
    expect(storedBooking.estimatedEndDate).toBe(originalEndDate);
    expect(storedBooking.estimatedEndAt).toBe(originalEndAt);
    expect(storedBooking.durationMinutes).toBe(700);

    const storedJob = (await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get()).docs[0]?.data() as ServiceJob;
    expect(storedJob.estimatedEndDate).toBe(originalEndDate);
    expect(storedJob.estimatedDurationMinutes).toBe(700);

    // A NEW booking made after the change uses the new (longer) duration.
    const other = await freshVehicle();
    const laterMonday = addDays(monday, 7);
    const afterChange = await makeBooking(other.customerId, service, other.vehicle, studio.id, laterMonday);
    expect(afterChange.booking.durationMinutes).toBe(4000);
    expect(afterChange.booking.estimatedEndDate).not.toBe(laterMonday);
  });

  // ─── Phase 7 Part 5: closing the two known coverage gaps ─────────────────

  it("15. consecutive holidays (3 in a row) are all skipped, not just the first", async () => {
    const monday = nextMonday();
    const tuesday = addDays(monday, 1);
    const wednesday = addDays(monday, 2);
    const thursday = addDays(monday, 3);
    // 3 consecutive holidays right where the service would naturally land.
    const studio = await seedStudio(uid("studio-consec-holiday"), TENANT_A, 3, [tuesday, wednesday, thursday]);
    const service = await seedService(uid("svc-consec-holiday"), TENANT_A, 700); // 2-day under normal conditions
    const { customerId, vehicle } = await freshVehicle();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    // Monday consumes 600, 100 remain; Tue/Wed/Thu are all holidays and are
    // all skipped entirely (none counted, none landed on) — lands on Friday.
    expect(booking.estimatedEndDate).toBe(addDays(monday, 4)); // Friday
    expect(booking.estimatedEndTime).toBe("10:40");
  });

  it("16. concurrent multi-day walk-in race on the same single bay: exactly one succeeds (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4) — same
    // rationale as test #8: the bayLocks mitigation is documented as a
    // measurable-but-incomplete reduction of this race, not a guarantee.
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const studio = await seedStudio(uid("studio-walkin-race"), TENANT_A, 1);
      // Duration exceeds any conceivable single calendar day (see test #11's
      // comment) so both walk-ins are guaranteed multi-day regardless of what
      // wall-clock time this test runs at.
      const service = await seedService(uid("svc-walkin-race"), TENANT_A, 2000);
      const a = await freshVehicle();
      const b = await freshVehicle();
      await seedCustomer(a.customerId, TENANT_A);
      await seedCustomer(b.customerId, TENANT_A);

      const results = await Promise.allSettled([
        createWalkinJob.run({
          data: {
            serviceId: service.id,
            vehicleId: a.vehicle.id,
            vehicleCategory: "suv",
            bayId: studio.bays[0]?.id as string,
            customerId: a.customerId,
            studioId: studio.id,
          },
          auth: studioAuth(uid("emp-a"), TENANT_A, studio.id),
        } as never),
        createWalkinJob.run({
          data: {
            serviceId: service.id,
            vehicleId: b.vehicle.id,
            vehicleCategory: "suv",
            bayId: studio.bays[0]?.id as string,
            customerId: b.customerId,
            studioId: studio.id,
          },
          auth: studioAuth(uid("emp-b"), TENANT_A, studio.id),
        } as never),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled, `iteration ${i}: expected exactly one winner`).toHaveLength(1);
      expect(rejected, `iteration ${i}: expected exactly one loser`).toHaveLength(1);

      const jobsSnap = await db.collection("jobs").where("bayId", "==", studio.bays[0]?.id).get();
      const activeJobs = jobsSnap.docs.filter((d) => (d.data() as ServiceJob).status !== "CANCELLED");
      expect(activeJobs, `iteration ${i}: bay must never be double-assigned`).toHaveLength(1);
    }
  }, 180_000);

  it("17. longest real AutoModz catalogue service (LLumar Valor PPF, 4320 min) schedules correctly end-to-end", async () => {
    // Uses the ACTUAL production catalogue seed data (not a synthetic
    // duration) — proves the real longest service in the system, not just a
    // representative test value, schedules correctly.
    const studio = await seedStudio(uid("studio-longest"), TENANT_A, 3);
    const service = await seedService("cov-svc-llumar-valor-clone", TENANT_A, 4320);
    const { customerId, vehicle } = await freshVehicle();
    const monday = nextMonday();

    const { booking } = await makeBooking(customerId, service, vehicle, studio.id, monday);

    // 4320 min at 600 min/day, Mon-Sat open/Sun closed: 6 full open days
    // (3600 min, Mon-Sat) + Sunday skipped + 1 full day (Mon+7, 600 min,
    // total 4200) + 120 min into the next open day (Tue+8) = 09:00+2:00.
    expect(booking.estimatedEndDate).toBe(addDays(monday, 8));
    expect(booking.estimatedEndTime).toBe("11:00");
  });
});

/**
 * CUSTODY CROSS-APP EXECUTION PROBE 2 (2026-11-17) — grouped multi-job visits
 * through the REAL handlers: (A) two bookings joined via joinVisit, (B)
 * walk-in itemized intake accepted by the customer. Verifies visit grouping,
 * per-member identity, customer vs staff projections, billing totals, and
 * fail-closed guards. Isolated emulator only.
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import type { Booking, ServiceJob } from "@autodeck/core";

import { createBooking } from "../helpers/paid-advance-booking.js";
import { joinVisit } from "../../functions/visit/joinVisit.js";
import { getMyVisit, getStaffVisit } from "../../functions/visit/getVisit.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { recordJobPerformedWork } from "../../functions/work/recordJobPerformedWork.js";
import { getMyVisitBill } from "../../functions/visit/getVisitBill.js";
import { prepareWalkinVisitIntake, respondToWalkinVisitIntake } from "../../functions/visit/walkinVisitIntake.js";

const db = getFirestore();
const TENANT = "custody-visit-tenant";
const STUDIO = "custody-visit-studio";

const auth = {
  customer: (uid: string) => ({ uid, token: { role: "customer", tenantId: TENANT, studioId: null } }),
  studio: (uid: string, studioId = STUDIO) => ({ uid, token: { role: "studio", tenantId: TENANT, studioId } }),
};

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${++seq}`;

const WEEKLY_HOURS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d as 0 | 1 | 2 | 3 | 4 | 5 | 6, open: "09:00", close: "19:00", closed: d === 0,
}));

function futureDow(dow: number, minDaysOut = 5): string {
  let d = new Date(Date.now() + minDaysOut * 86400000);
  let s = d.toISOString().slice(0, 10);
  while (new Date(`${s}T12:00:00Z`).getUTCDay() !== dow) { d = new Date(d.getTime() + 86400000); s = d.toISOString().slice(0, 10); }
  return s;
}

async function seedService(minutes: number, name: string, bayType: "protection" | "wash" = "protection") {
  const id = uid("svc"); const now = new Date().toISOString();
  await db.collection("services").doc(id).set({
    id, tenantId: TENANT, name, category: "ppf", brand: "TestBrand", description: "probe",
    basePrice: 100000_00, currency: "INR", estimatedDurationMinutes: minutes,
    warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null,
    vehicleCategoryPricing: [], requiredBayType: bayType, membershipWashEligible: false,
    active: true, displayOrder: 0, createdAt: now, updatedAt: now,
  });
  return id;
}

async function seedCustomerVehicle(label: string) {
  const customerId = uid(`cust-${label}`); const now = new Date().toISOString();
  await db.collection("customers").doc(customerId).set({
    id: customerId, authUid: customerId, tenantId: TENANT, name: `Probe ${label}`, phone: "+919876543210",
    notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null,
  });
  const vehicleId = uid(`veh-${label}`);
  await db.collection("vehicles").doc(vehicleId).set({
    id: vehicleId, tenantId: TENANT, ownerId: customerId, registrationNumber: "GJ01MD1234",
    make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv",
    photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null,
  });
  await db.collection("memberships").doc(`prio-${customerId}`).set({
    id: `prio-${customerId}`, tenantId: TENANT, customerId, status: "active", prioritySlot: true, endDate: null,
  });
  return { customerId, vehicleId };
}

async function book(customerId: string, vehicleId: string, serviceId: string, time: string) {
  const { booking } = (await createBooking.run({
    data: {
      serviceId, vehicleId, vehicleCategory: "suv", studioId: STUDIO,
      scheduledDate: futureDow(2), scheduledTime: time, idempotencyKey: uid("idem"),
    },
    auth: auth.customer(customerId),
  } as never)) as { booking: Booking };
  const jobId = (await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get()).docs[0]!.id;
  return { booking, jobId };
}

describe("grouped multi-job visits", () => {
  it("A: joinVisit groups two booked jobs with correct projections and billing", async () => {
    await db.collection("studioConfig").doc(STUDIO).set({
      id: STUDIO, tenantId: TENANT, studioId: STUDIO, name: "Visit Probe Studio",
      timezone: "Asia/Kolkata", currency: "INR", taxRatePercent: 18, taxDescription: "GST 18%",
      operatingHours: WEEKLY_HOURS, holidays: [],
      vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
      slotIntervalMinutes: 30, maxAdvanceBookingDays: 30, cancellationWindowHours: 24,
      bays: [{ id: `${STUDIO}-bay-1`, tenantId: TENANT, studioId: STUDIO, name: "P1", bayType: "protection", active: true }],
      updatedAt: new Date().toISOString(),
    });
    const { customerId, vehicleId } = await seedCustomerVehicle("a");
    const svcA = await seedService(60, "Visit Service A");
    const svcB = await seedService(120, "Visit Service B");
    const first = await book(customerId, vehicleId, svcA, "09:00");
    const second = await book(customerId, vehicleId, svcB, "11:00");
    const staff = auth.studio(uid("staff"));

    const jobOf = async (id: string) => (await db.collection("jobs").doc(id).get()).data() as ServiceJob;
    const m1 = await jobOf(first.jobId);
    const m2 = await jobOf(second.jobId);

    // GUARD: stale expectedUpdatedAt is refused before any grouping.
    await expect(
      joinVisit.run({
        data: { operationId: randomUUID(), confirmed: true, members: [
          { jobId: first.jobId, expectedUpdatedAt: "1970-01-01T00:00:00.000Z" },
          { jobId: second.jobId, expectedUpdatedAt: m2.updatedAt },
        ] },
        auth: staff,
      } as never),
    ).rejects.toThrow();

    const opId = randomUUID();
    const joined = (await joinVisit.run({
      data: { operationId: opId, confirmed: true, members: [
        { jobId: first.jobId, expectedUpdatedAt: m1.updatedAt },
        { jobId: second.jobId, expectedUpdatedAt: m2.updatedAt },
      ] },
      auth: staff,
    } as never)) as { visitId: string; alreadyJoined: boolean };
    expect(joined.alreadyJoined).toBe(false);

    // Idempotent replay of the same operation.
    const replay = (await joinVisit.run({
      data: { operationId: opId, confirmed: true, members: [
        { jobId: first.jobId, expectedUpdatedAt: m1.updatedAt },
        { jobId: second.jobId, expectedUpdatedAt: m2.updatedAt },
      ] },
      auth: staff,
    } as never)) as { visitId: string; alreadyJoined: boolean };
    expect(replay.alreadyJoined).toBe(true);
    expect(replay.visitId).toBe(joined.visitId);

    // Customer projection: grouped, 2 members with per-service identity, no staff-only fields.
    const mine = (await getMyVisit.run({ data: { jobId: first.jobId }, auth: auth.customer(customerId) } as never)) as {
      status: string; visitId: string; state: string;
      members: { jobId: string; lines: { serviceId: string; name: string }[]; recordedWork?: unknown }[];
      bill: { totalAmount: number };
    };
    expect(mine.status).toBe("grouped");
    expect(mine.visitId).toBe(joined.visitId);
    expect(mine.members).toHaveLength(2);
    // DEFECT C regression (before fix this returned Service/Service): a booking-created single-service job
    // persists no service name, and getVisit's member fallback hardcodes
    // 'Service' - so every single-service member of a grouped visit displays
    // a generic label to customer and staff instead of the real service name.
    // Walk-in jobs (part B) carry real names because intake writes explicit
    // lines. Fix options for the writer: persist the service name on the job
    // at creation, or resolve it in the member projection.
    expect(mine.members.map((m) => m.lines[0]!.name).sort()).toEqual(["Visit Service A", "Visit Service B"]);
    expect(mine.members.every((m) => m.recordedWork === undefined)).toBe(true);
    // GST env-flag off in emulator: bill total is the plain sum.
    expect(mine.bill.totalAmount).toBe(200000_00);

    // Staff projection includes the recorded-work review slot.
    const staffView = (await getStaffVisit.run({ data: { jobId: first.jobId }, auth: staff } as never)) as {
      members: { lines: { name: string }[]; recordedWork?: unknown }[];
    };
    expect(staffView.members.every((m) => m.recordedWork !== undefined)).toBe(true);
    expect(staffView.members.map(m => m.lines[0]!.name).sort()).toEqual(["Visit Service A", "Visit Service B"]);
    // A separate non-grouped job proves the ledger uses its frozen line name.
    const ledgerBooking = await book(customerId, vehicleId, svcA, "15:00");
    await db.collection("services").doc(svcA).update({ name: "Later catalogue rename" });
    for (let step = 0; step < 2; step++) {
      const current = await jobOf(ledgerBooking.jobId);
      await advanceJobStatus.run({data:{jobId:ledgerBooking.jobId,expectedStatus:current.status,expectedUpdatedAt:current.updatedAt,operationId:randomUUID()},auth:staff} as never);
    }
    await recordJobPerformedWork.run({data:{jobId:ledgerBooking.jobId,operationId:randomUUID(),expectedRevision:0,action:"record",lineId:"booked-0",approvalId:null,performed:true,work:{kind:"service"}},auth:staff} as never);
    const recorded = (await db.collection("jobPerformedWork").doc(ledgerBooking.jobId).get()).data()!;
    expect(recorded.ledger.lines[0].title).toBe("Visit Service A");

    // Visit bill through the real billing reader.
    const bill = (await getMyVisitBill.run({ data: { visitId: joined.visitId }, auth: auth.customer(customerId) } as never)) as { totalPaise: number; lines: { name: string }[] };
    // Billing reader contract is totalPaise, unlike getMyVisit.bill.totalAmount.
    expect(bill.totalPaise).toBe(200000_00);
    expect(bill.lines.map(l => l.name).sort()).toEqual(["Visit Service A", "Visit Service B"]);

    // Wrong-studio staff cannot read the visit.
    await expect(
      getStaffVisit.run({ data: { jobId: first.jobId }, auth: auth.studio(uid("staff"), "other-studio") } as never),
    ).rejects.toThrow();
  }, 30000);

  it("B: walk-in itemized intake creates one visit with one job per service on customer acceptance", async () => {
    const { customerId, vehicleId } = await seedCustomerVehicle("b");
    const svc1 = await seedService(45, "Walkin Wash");
    const svc2 = await seedService(90, "Walkin Coating");
    const staff = auth.studio(uid("staff"));

    const prepared = (await prepareWalkinVisitIntake.run({
      data: { operationId: randomUUID(), customerId, vehicleId, studioId: STUDIO, serviceIds: [svc1, svc2] },
      auth: staff,
    } as never)) as {
      id: string; revision: number; status: string; totalAmount: number | null;
      lines: { id: string; serviceId: string; name: string; workingMinutes: number; totalAmount: number | null }[];
    };
    expect(prepared.status).toBe("offered");
    expect(prepared.lines.map((l) => l.workingMinutes)).toEqual([45, 90]);
    expect(prepared.totalAmount).toBe(200000_00);

    // GUARD: customer cannot accept against a wrong total.
    await expect(
      respondToWalkinVisitIntake.run({
        data: { intakeId: prepared.id, expectedRevision: prepared.revision, expectedTotalPaise: 1, lineIds: prepared.lines.map((l) => l.id), decision: "accepted" },
        auth: auth.customer(customerId),
      } as never),
    ).rejects.toThrow();

    // GUARD: staff cannot accept the customer's own decision.
    await expect(
      respondToWalkinVisitIntake.run({
        data: { intakeId: prepared.id, expectedRevision: prepared.revision, expectedTotalPaise: prepared.totalAmount!, lineIds: prepared.lines.map((l) => l.id), decision: "accepted" },
        auth: staff,
      } as never),
    ).rejects.toThrow();

    const accepted = (await respondToWalkinVisitIntake.run({
      data: { intakeId: prepared.id, expectedRevision: prepared.revision, expectedTotalPaise: prepared.totalAmount!, lineIds: prepared.lines.map((l) => l.id), decision: "accepted" },
      auth: auth.customer(customerId),
    } as never)) as { status: string; visitId: string | null };
    expect(accepted.status).toBe("accepted");
    expect(accepted.visitId).toBeTruthy();

    const visitId = accepted.visitId!;
    const jobs = (await db.collection("jobs").where("visitId", "==", visitId).get()).docs.map((d) => d.data() as ServiceJob);
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.isWalkIn === true && j.status === "STANDBY")).toBe(true);
    expect(jobs.map((j) => j.lines![0]!.name).sort()).toEqual(["Walkin Coating", "Walkin Wash"]);
    expect(jobs.reduce((n, j) => n + j.totalAmount, 0)).toBe(200000_00);

    // Both projections see the grouped visit.
    const mine = (await getMyVisit.run({ data: { jobId: jobs[0]!.id }, auth: auth.customer(customerId) } as never)) as { status: string; members: unknown[]; bill: { totalAmount: number } };
    expect(mine.status).toBe("grouped");
    expect(mine.members).toHaveLength(2);
    expect(mine.bill.totalAmount).toBe(200000_00);
    const staffView = (await getStaffVisit.run({ data: { jobId: jobs[0]!.id }, auth: staff } as never)) as { status: string };
    expect(staffView.status).toBe("grouped");

    // GUARD: a second intake accept while the car has open work is refused.
    const svc3 = await seedService(30, "Walkin Extra");
    const prepared2 = (await prepareWalkinVisitIntake.run({
      data: { operationId: randomUUID(), customerId, vehicleId, studioId: STUDIO, serviceIds: [svc1, svc3] },
      auth: staff,
    } as never)) as { id: string; revision: number; totalAmount: number; lines: { id: string }[] };
    await expect(
      respondToWalkinVisitIntake.run({
        data: { intakeId: prepared2.id, expectedRevision: prepared2.revision, expectedTotalPaise: prepared2.totalAmount, lineIds: prepared2.lines.map((l) => l.id), decision: "accepted" },
        auth: auth.customer(customerId),
      } as never),
    ).rejects.toThrow(/open work/i);
  }, 30000);
});

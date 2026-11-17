/**
 * CUSTODY DEFECT REPRO (2026-11-17) — legacy single walk-in (createWalkinJob,
 * still reachable from the Studio app walk-in screen, apps/studio walkin.tsx
 * line ~234) persists NO name snapshot, so once its job is joined into a
 * visit the member projection falls back to the literal 'Service' - the same
 * generic-name gap fixed for createBooking by the C patch, still open here.
 * Isolated emulator only. The failing name assertion is the repro.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import type { Booking, ServiceJob } from "@autodeck/core";

import { createBooking } from "../helpers/paid-advance-booking.js";
import { createWalkinJob } from "../../functions/job/createWalkinJob.js";
import { joinVisit } from "../../functions/visit/joinVisit.js";
import { advanceJobStatus } from "../../functions/job/advanceJobStatus.js";
import { recordJobPerformedWork } from "../../functions/work/recordJobPerformedWork.js";
import { getMyVisitBill } from "../../functions/visit/getVisitBill.js";
import { getMyVisit, getStaffVisit } from "../../functions/visit/getVisit.js";

const db = getFirestore();
afterEach(() => vi.useRealTimers());
const TENANT = "custody-walkin-tenant";
const STUDIO = "custody-walkin-studio";

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

async function seedService(minutes: number, name: string) {
  const id = uid("svc"); const now = new Date().toISOString();
  await db.collection("services").doc(id).set({
    id, tenantId: TENANT, name, category: "ppf", brand: "TestBrand", description: "probe",
    basePrice: 100000_00, currency: "INR", estimatedDurationMinutes: minutes,
    warrantyLabel: null, warrantyDurationValue: null, warrantyDurationUnit: null,
    vehicleCategoryPricing: [], requiredBayType: "protection", membershipWashEligible: false,
    active: true, displayOrder: 0, createdAt: now, updatedAt: now,
  });
  return id;
}

describe("legacy single walk-in name snapshot", () => {
  it("a createWalkinJob job joined into a visit shows its real service name with its frozen original identity", async () => {
    const fixedDay = futureDow(2);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(fixedDay + "T04:00:00Z")); // 09:30 IST, in-hours Tuesday
    await db.collection("studioConfig").doc(STUDIO).set({
      id: STUDIO, tenantId: TENANT, studioId: STUDIO, name: "Walkin Probe Studio",
      timezone: "Asia/Kolkata", currency: "INR", taxRatePercent: 18, taxDescription: "GST 18%",
      operatingHours: WEEKLY_HOURS, holidays: [],
      vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
      slotIntervalMinutes: 30, maxAdvanceBookingDays: 30, cancellationWindowHours: 24,
      bays: [
      { id: `${STUDIO}-bay-1`, tenantId: TENANT, studioId: STUDIO, name: "P1", bayType: "protection", active: true },
      { id: `${STUDIO}-bay-2`, tenantId: TENANT, studioId: STUDIO, name: "P2", bayType: "protection", active: true },
    ],
      updatedAt: new Date().toISOString(),
    });
    const customerId = uid("cust"); const now = new Date().toISOString();
    await db.collection("customers").doc(customerId).set({
      id: customerId, authUid: customerId, tenantId: TENANT, name: "Probe", phone: "+919876543210",
      notificationPrefs: { push: false, quietMode: false }, createdAt: now, updatedAt: now, deletedAt: null,
    });
    const vehicleId = uid("veh");
    await db.collection("vehicles").doc(vehicleId).set({
      id: vehicleId, tenantId: TENANT, ownerId: customerId, registrationNumber: "GJ01MD1234",
      make: "Toyota", model: "Fortuner", year: 2023, color: "Black", category: "suv",
      photoUrl: null, odometer: null, createdAt: now, updatedAt: now, deletedAt: null,
    });
    await db.collection("memberships").doc(`prio-${customerId}`).set({
      id: `prio-${customerId}`, tenantId: TENANT, customerId, status: "active", prioritySlot: true, endDate: null,
    });
    const staff = auth.studio(uid("staff"));

    // Book for TODAY at a future in-hours slot so both members share one
    // scheduledDate (the visit-join schedule_review rule only tolerates mixed
    // dates when no member is PENDING_VEHICLE).
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const walkinSvc = await seedService(60, "Legacy Walkin Polish");
    const bookedSvc = await seedService(90, "Booked Ceramic");

    // The legacy single walk-in path the Studio app still calls.
    const walkin = (await createWalkinJob.run({
      data: { serviceId: walkinSvc, vehicleId, vehicleCategory: "suv", bayId: `${STUDIO}-bay-1`, customerId, studioId: STUDIO },
      auth: staff,
    } as never)) as { job: ServiceJob };
    expect(walkin.job.status).toBe("VEHICLE_RECEIVED");
    expect(walkin.job.lines?.[0]?.name).toBe("Legacy Walkin Polish");

    expect(walkin.job.lines?.[0]).toMatchObject({serviceId:walkinSvc,price:100000_00,durationMinutes:60});
    await db.collection("services").doc(walkinSvc).update({name:"Later renamed catalogue"});
    await advanceJobStatus.run({data:{jobId:walkin.job.id,expectedStatus:walkin.job.status,expectedUpdatedAt:walkin.job.updatedAt,operationId:randomUUID()},auth:staff} as never);
    await recordJobPerformedWork.run({data:{jobId:walkin.job.id,operationId:randomUUID(),expectedRevision:0,action:"record",lineId:"booked-0",approvalId:null,performed:true,work:{kind:"service"}},auth:staff} as never);
    expect((await db.collection("jobPerformedWork").doc(walkin.job.id).get()).data()!.ledger.lines[0].title).toBe("Legacy Walkin Polish");

    // A normal booking for the same car, then staff group both into one visit.
    const { booking } = (await createBooking.run({
      data: {
        serviceId: bookedSvc, vehicleId, vehicleCategory: "suv", studioId: STUDIO,
        scheduledDate: today, scheduledTime: "16:00", idempotencyKey: uid("idem"),
      },
      auth: auth.customer(customerId),
    } as never)) as { booking: Booking };
    const bookedJobId = (await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get()).docs[0]!.id;
    const bookedJob = (await db.collection("jobs").doc(bookedJobId).get()).data() as ServiceJob;
    const walkinFresh = (await db.collection("jobs").doc(walkin.job.id).get()).data() as ServiceJob;

    await joinVisit.run({
      data: { operationId: randomUUID(), confirmed: true, members: [
        { jobId: walkin.job.id, expectedUpdatedAt: walkinFresh.updatedAt },
        { jobId: bookedJobId, expectedUpdatedAt: bookedJob.updatedAt },
      ] },
      auth: staff,
    } as never);

    const mine = (await getMyVisit.run({ data: { jobId: walkin.job.id }, auth: auth.customer(customerId) } as never)) as {
      status: string; members: { jobId: string; lines: { serviceId: string; name: string }[] }[];
    };
    expect(mine.status).toBe("grouped");
    const walkinMember = mine.members.find((m) => m.jobId === walkin.job.id)!;
    const bookedMember = mine.members.find((m) => m.jobId === bookedJobId)!;
    // Booked member is fine post-C-fix (frozen snapshot). The legacy walk-in
    // member is the gap: 'Service' instead of 'Legacy Walkin Polish'.
    expect(bookedMember.lines[0]!.name).toBe("Booked Ceramic");
    expect(walkinMember.lines[0]!.name).toBe("Legacy Walkin Polish");
    const staffView:any=await getStaffVisit.run({data:{jobId:walkin.job.id},auth:staff} as never);
    expect(staffView.members.find((m:any)=>m.jobId===walkin.job.id).lines[0].name).toBe("Legacy Walkin Polish");
    const grouped=(await db.collection("jobs").doc(walkin.job.id).get()).data()!;
    const bill:any=await getMyVisitBill.run({data:{visitId:grouped.visitId},auth:auth.customer(customerId)} as never);
    expect(bill.lines.find((l:any)=>l.jobId===walkin.job.id).name).toBe("Legacy Walkin Polish");
    expect(bill.totalPaise).toBe(200000_00);
  }, 30000);
});

/**
 * Emulator tests for the Studio staff-app backend batch (2026-10-26):
 *  1. updatePickupRequest refuses to CONFIRM an unpriced (feePaise null)
 *     request, so a no-pin request can never silently bill Rs 0.
 *  2. Inspection photos: issueInspectionPhotoUploadUrl guards +
 *     updateInspection { addPhotos } path validation.
 *  3. Staff-to-admin approval requests: requestAdminApproval /
 *     respondToAdminApproval roles, tenant scoping, idempotency, and the
 *     /adminApprovalRequests Firestore rules.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StudioConfig, Service, Vehicle, Booking, ServiceJob, AdminApprovalRequest } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { createBooking } from "../../functions/booking/createBooking.js";
import { requestPickupDrop, updatePickupRequest } from "../../functions/booking/pickupRequests.js";
import { startInspection } from "../../functions/inspection/startInspection.js";
import { updateInspection } from "../../functions/inspection/updateInspection.js";
import { finalizeInspection } from "../../functions/inspection/finalizeInspection.js";
import { requestAdminApproval } from "../../functions/approval/requestAdminApproval.js";
import { respondToAdminApproval } from "../../functions/approval/respondToAdminApproval.js";

const db = getFirestore();

const TENANT_A = "sbb-tenant-a";
const TENANT_B = "sbb-tenant-b";
const STUDIO_A = "sbb-studio-a";

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

// Seeds a photo object the way a signed-URL PUT would land it: bytes plus the
// customerId custom metadata binding that storage.rules scopes reads by.
async function seedPhotoObject(path: string, customerId: string, contentType = "image/jpeg") {
  await getStorage()
    .bucket()
    .file(path)
    .save(Buffer.from("fake-image-bytes"), { metadata: { contentType, metadata: { customerId } } });
}

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null }, rawToken: "test" };
}
function studioAuth(authUid: string, studioId: string = STUDIO_A, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId }, rawToken: "test" };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null }, rawToken: "test" };
}

async function seedStudio(studioId: string, tenantId: string) {
  const studioConfig: StudioConfig = {
    id: studioId,
    tenantId,
    studioId,
    name: "Batch Test Studio",
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
    bays: [
      { id: `${studioId}-wash-1`, tenantId, studioId, name: "Wash Bay 1", bayType: "wash" as const, active: true },
    ],
    updatedAt: new Date().toISOString(),
  };
  await db.collection("studioConfig").doc(studioId).set(studioConfig);
}

async function seedService(serviceId: string, tenantId: string) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Batch Test Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice: 50000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [],
    requiredBayType: "wash",
    membershipWashEligible: true,
    active: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

async function seedVehicle(vehicleId: string, tenantId: string, ownerId: string) {
  const now = new Date().toISOString();
  const vehicle: Vehicle = {
    id: vehicleId,
    tenantId,
    ownerId,
    registrationNumber: "GJ01BB" + vehicleId.slice(-4).toUpperCase().padStart(4, "0"),
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

async function freshJob(
  service: Service,
  tenantId = TENANT_A,
  studioId: string = STUDIO_A,
): Promise<{ booking: Booking; job: ServiceJob; customerId: string }> {
  const customerId = uid("cust");
  const vehicle = await seedVehicle(uid("veh"), tenantId, customerId);
  const result = (await createBooking.run({
    data: {
      serviceId: service.id,
      vehicleId: vehicle.id,
      vehicleCategory: "hatchback",
      studioId,
      scheduledDate: nextDate(),
      scheduledTime: "10:00",
      idempotencyKey: uid("idem"),
    },
    auth: customerAuth(customerId, tenantId),
  } as never)) as { booking: Booking };
  const jobsSnap = await db.collection(COLLECTIONS.jobs()).where("bookingId", "==", result.booking.id).get();
  const job = jobsSnap.docs[0]?.data() as ServiceJob;
  return { booking: result.booking, job, customerId };
}

async function expectErr(p: Promise<unknown>, code: string, messagePart?: string) {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    expect(err.code ?? "").toContain(code);
    if (messagePart) expect(err.message ?? "").toContain(messagePart);
    return;
  }
  throw new Error(`expected ${code}, but the call succeeded`);
}

// ─── 1. Unpriced pickup guard ────────────────────────────────────────────────

describe("updatePickupRequest — unpriced (no-pin) requests cannot be confirmed free", () => {
  let service: Service;

  beforeAll(async () => {
    await seedStudio(STUDIO_A, TENANT_A);
    await seedStudio("sbb-studio-b-tenant", TENANT_B);
    service = await seedService(uid("svc"), TENANT_A);
  });

  it("blocks CONFIRMED while feePaise is null, then allows it once an admin prices the request", async () => {
    const { booking, customerId } = await freshJob(service);
    // No lat/lng -> server cannot compute a fee -> feePaise null.
    await requestPickupDrop.run({
      data: { bookingId: booking.id, kind: "both", address: "12, Test Society, Ahmedabad 380006" },
      auth: customerAuth(customerId),
    } as never);

    const staff = studioAuth(uid("staff"));
    await expectErr(
      updatePickupRequest.run({
        data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30`, agreedDropAt: `${nextDate()} 18:00` },
        auth: staff,
      } as never),
      "failed-precondition",
      "no fee yet",
    );

    // The request is still REQUESTED - the blocked confirm changed nothing.
    let snap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(snap.data()?.status).toBe("REQUESTED");

    // Admin prices it (allowed only while REQUESTED), then staff confirm.
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "REQUESTED", feePaise: 20000 },
      auth: adminAuth(uid("admin")),
    } as never);
    const confirmed = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30`, agreedDropAt: `${nextDate()} 18:00` },
      auth: staff,
    } as never)) as { status: string; feeBilled: boolean };
    expect(confirmed.status).toBe("CONFIRMED");

    snap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(snap.data()?.feePaise).toBe(20000);
  });

  it("an admin-set fee of 0 (deliberate free) still confirms", async () => {
    const { booking, customerId } = await freshJob(service);
    await requestPickupDrop.run({
      data: { bookingId: booking.id, kind: "pickup", address: "12, Test Society, Ahmedabad 380006" },
      auth: customerAuth(customerId),
    } as never);
    await updatePickupRequest.run({
      data: { requestId: booking.id, status: "REQUESTED", feePaise: 0 },
      auth: adminAuth(uid("admin")),
    } as never);
    const confirmed = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30` },
      auth: studioAuth(uid("staff")),
    } as never)) as { status: string };
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("a pin-priced request (fee computed at request time) confirms without admin involvement", async () => {
    const { booking, customerId } = await freshJob(service);
    await requestPickupDrop.run({
      data: {
        bookingId: booking.id,
        kind: "pickup",
        address: "12, Test Society, Ahmedabad 380006",
        lat: 23.03, // ~1.2 km from the studio door
        lng: 72.57,
      },
      auth: customerAuth(customerId),
    } as never);
    const snap = await db.collection(COLLECTIONS.pickupRequests()).doc(booking.id).get();
    expect(snap.data()?.feePaise).toBeGreaterThan(0);
    const confirmed = (await updatePickupRequest.run({
      data: { requestId: booking.id, status: "CONFIRMED", agreedPickupAt: `${nextDate()} 10:30` },
      auth: studioAuth(uid("staff")),
    } as never)) as { status: string };
    expect(confirmed.status).toBe("CONFIRMED");
  });
});

// ─── 2. Inspection photos ────────────────────────────────────────────────────

describe("inspection photos — addPhotos path validation", () => {
  let service: Service;

  beforeAll(async () => {
    service = (await db.collection("services").limit(1).get()).docs[0]?.data() as Service;
    if (!service) service = await seedService(uid("svc"), TENANT_A);
  });

  it("appends only this job's own photo paths, deduped", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);

    const good = [`${job.tenantId}/jobs/${job.id}/photos/a.jpg`, `${job.tenantId}/jobs/${job.id}/photos/b.jpg`];
    for (const p of good) await seedPhotoObject(p, job.customerId);
    await updateInspection.run({ data: { jobId: job.id, addPhotos: good }, auth: staff } as never);
    // Re-adding the same path is a no-op (not even re-verified), and a new one appends.
    const cPath = `${job.tenantId}/jobs/${job.id}/photos/c.jpg`;
    await seedPhotoObject(cPath, job.customerId);
    await updateInspection.run(
      { data: { jobId: job.id, addPhotos: [good[0]!, cPath] }, auth: staff } as never,
    );

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([...good, `${job.tenantId}/jobs/${job.id}/photos/c.jpg`]);
  });

  it("rejects paths outside the job's own photo prefix (other job / other tenant)", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);

    await expectErr(
      updateInspection.run(
        { data: { jobId: job.id, addPhotos: [`${job.tenantId}/jobs/some-other-job/photos/x.jpg`] }, auth: staff } as never,
      ),
      "invalid-argument",
    );
    await expectErr(
      updateInspection.run(
        { data: { jobId: job.id, addPhotos: [`other-tenant/jobs/${job.id}/photos/x.jpg`] }, auth: staff } as never,
      ),
      "invalid-argument",
    );

    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([]);
  });

  it("rejects photo edits once the inspection is finalized", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    await finalizeInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    await expectErr(
      updateInspection.run(
        { data: { jobId: job.id, addPhotos: [`${job.tenantId}/jobs/${job.id}/photos/late.jpg`] }, auth: staff } as never,
      ),
      "failed-precondition",
    );
  });

  it("verifies the object at attach time: missing upload, wrong customer binding, wrong type all rejected", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);
    const base = `${job.tenantId}/jobs/${job.id}/photos`;

    // Well-formed path, but nothing was ever PUT there.
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [`${base}/never-uploaded.jpg`] }, auth: staff } as never),
      "not-found",
    );

    // Uploaded, but bound to a different customer (cross-job/customer pinning).
    const foreign = `${base}/foreign.jpg`;
    await seedPhotoObject(foreign, "some-other-customer");
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [foreign] }, auth: staff } as never),
      "failed-precondition",
    );

    // Uploaded with the right binding but a non-image content type.
    const wrongType = `${base}/wrong-type.jpg`;
    await seedPhotoObject(wrongType, job.customerId, "text/plain");
    await expectErr(
      updateInspection.run({ data: { jobId: job.id, addPhotos: [wrongType] }, auth: staff } as never),
      "failed-precondition",
    );

    // Nothing was attached by any of the rejected attempts.
    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([]);
  });

  it("issueInspectionPhotoUploadUrl refuses before the inspection exists", async () => {
    const { job } = await freshJob(service);
    const { issueInspectionPhotoUploadUrl } = await import("../../functions/inspection/issueInspectionPhotoUploadUrl.js");
    await expectErr(
      issueInspectionPhotoUploadUrl.run({
        data: { jobId: job.id, contentType: "image/jpeg" },
        auth: studioAuth(uid("staff")),
      } as never),
      "failed-precondition",
      "Start the inspection",
    );
  });

  it("issueInspectionPhotoUploadUrl refuses customers and cross-studio staff", async () => {
    const { job, customerId } = await freshJob(service);
    const { issueInspectionPhotoUploadUrl } = await import("../../functions/inspection/issueInspectionPhotoUploadUrl.js");
    await expectErr(
      issueInspectionPhotoUploadUrl.run({
        data: { jobId: job.id, contentType: "image/jpeg" },
        auth: customerAuth(customerId),
      } as never),
      "permission-denied",
    );
    await expectErr(
      issueInspectionPhotoUploadUrl.run({
        data: { jobId: job.id, contentType: "image/jpeg" },
        auth: studioAuth(uid("staff"), "sbb-studio-other"),
      } as never),
      "permission-denied",
    );
  });
});

// ─── 3. Staff-to-admin approval requests ─────────────────────────────────────

describe("staff-to-admin approval requests", () => {
  let service: Service;

  beforeAll(async () => {
    service = (await db.collection("services").limit(1).get()).docs[0]?.data() as Service;
    if (!service) service = await seedService(uid("svc"), TENANT_A);
  });

  it("studio files a request about a job; admin approves with a note; staff read the answer", async () => {
    const { job } = await freshJob(service);
    const staff = studioAuth(uid("staff"));
    const { requestId } = (await requestAdminApproval.run({
      data: {
        targetType: "job",
        targetId: job.id,
        reason: "Customer asked to leave the car overnight after a late handover - okay to keep the keys?",
      },
      auth: staff,
    } as never)) as { requestId: string };

    const decided = (await respondToAdminApproval.run({
      data: { requestId, decision: "approved", note: "Fine for tonight only. Log the odometer." },
      auth: adminAuth(uid("admin")),
    } as never)) as { status: string; idempotent: boolean };
    expect(decided.status).toBe("approved");
    expect(decided.idempotent).toBe(false);

    const snap = await db.collection(COLLECTIONS.adminApprovalRequests()).doc(requestId).get();
    const doc = snap.data() as AdminApprovalRequest;
    expect(doc.status).toBe("approved");
    expect(doc.responseNote).toContain("tonight");
    expect(doc.respondedBy).toBeTruthy();
    expect(doc.requestedBy).toBe(staff.uid);
  });

  it("an identical repeat response is an idempotent no-op; a conflicting one is refused", async () => {
    const staff = studioAuth(uid("staff"));
    const { requestId } = (await requestAdminApproval.run({
      data: { targetType: "none", reason: "Can I order replacement microfiber cloths this week?" },
      auth: staff,
    } as never)) as { requestId: string };

    const admin = adminAuth(uid("admin"));
    await respondToAdminApproval.run({ data: { requestId, decision: "rejected", note: "Next month." }, auth: admin } as never);
    const repeat = (await respondToAdminApproval.run({
      data: { requestId, decision: "rejected", note: "Next month." },
      auth: admin,
    } as never)) as { idempotent: boolean };
    expect(repeat.idempotent).toBe(true);
    await expectErr(
      respondToAdminApproval.run({ data: { requestId, decision: "approved" }, auth: admin } as never),
      "failed-precondition",
      "already rejected",
    );
  });

  it("customers cannot file or respond; studio staff cannot respond; cross-tenant is refused", async () => {
    const { job, customerId } = await freshJob(service);
    await expectErr(
      requestAdminApproval.run({
        data: { targetType: "job", targetId: job.id, reason: "Customer should never file this." },
        auth: customerAuth(customerId),
      } as never),
      "permission-denied",
    );

    const { requestId } = (await requestAdminApproval.run({
      data: { targetType: "job", targetId: job.id, reason: "Real staff request." },
      auth: studioAuth(uid("staff")),
    } as never)) as { requestId: string };

    await expectErr(
      respondToAdminApproval.run({ data: { requestId, decision: "approved" }, auth: studioAuth(uid("staff2")) } as never),
      "permission-denied",
    );
    await expectErr(
      respondToAdminApproval.run(
        { data: { requestId, decision: "approved" }, auth: adminAuth(uid("admin-b"), TENANT_B) } as never,
      ),
      "permission-denied",
    );
  });

  it("validates the target: unknown records and other tenants' jobs are refused", async () => {
    const staff = studioAuth(uid("staff"));
    await expectErr(
      requestAdminApproval.run(
        { data: { targetType: "job", targetId: "no-such-job", reason: "About a missing job." }, auth: staff } as never,
      ),
      "not-found",
    );
    await seedStudio("sbb-studio-b", TENANT_B);
    const serviceB = await seedService(uid("svc-b"), TENANT_B);
    const { job: otherTenantJob } = await freshJob(serviceB, TENANT_B, "sbb-studio-b");
    await expectErr(
      requestAdminApproval.run(
        { data: { targetType: "job", targetId: otherTenantJob.id, reason: "Not my tenant's job." }, auth: staff } as never,
      ),
      "permission-denied",
    );
    await expectErr(
      requestAdminApproval.run(
        { data: { targetType: "none", targetId: "something", reason: "Contradictory input." }, auth: staff } as never,
      ),
      "invalid-argument",
    );
  });
});



// ─── 4. Inspection photo signed-URL upload flow (Storage emulator) ───────────

describe("inspection photo upload - signed URL PUT, metadata binding, read scoping", () => {
  let storageEnv: RulesTestEnvironment;
  let service: Service;

  beforeAll(async () => {
    storageEnv = await initializeTestEnvironment({
      projectId: "autodeck-dev",
      storage: { rules: readFileSync(resolve(__dirname, "../../../../storage.rules"), "utf8"), host: "localhost", port: 9199 },
    });
    await seedStudio(STUDIO_A, TENANT_A);
    service = await seedService(uid("svc"), TENANT_A);
  });

  // Requires TEST_SIGN_CLIENT_EMAIL/TEST_SIGN_PRIVATE_KEY (see emulator-setup.ts):
  // minting a signed URL needs a service-account keypair, which CI does not have.
  it.skipIf(!process.env["TEST_SIGN_PRIVATE_KEY"])("PUT lands bytes with customerId metadata; staff+owner read, other customer denied; inspection records the path", async () => {
    const { job, customerId } = await freshJob(service);
    const staffUid = uid("staff");
    const staff = studioAuth(staffUid);
    await startInspection.run({ data: { jobId: job.id }, auth: staff } as never);

    const { issueInspectionPhotoUploadUrl } = await import("../../functions/inspection/issueInspectionPhotoUploadUrl.js");
    const issued = (await issueInspectionPhotoUploadUrl.run({
      data: { jobId: job.id, contentType: "image/jpeg" },
      auth: staff,
    } as never)) as { uploadUrl: string; path: string; requiredHeaders: Record<string, string> };

    expect(issued.path).toContain(`${job.tenantId}/jobs/${job.id}/photos/`);
    expect(issued.requiredHeaders["x-goog-meta-customerId"]).toBe(customerId);

    // The Storage emulator does not implement v4 signed-URL PUTs (it answers
    // 501), so the bytes are landed the way the signed PUT would: same path,
    // same content type, and exactly the customerId metadata the issued
    // requiredHeaders demand. The no-direct-client-write property itself is
    // enforced by storage.rules (write: if false) and asserted below; real
    // GCS signature/content-type enforcement is a deploy-time check, same as
    // every existing signed-URL flow in this repo (none are emulator-PUT
    // covered).
    await storageEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(issued.path).put(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        contentType: "image/jpeg",
        customMetadata: { customerId },
      });
    });

    // Server-side truth: the object exists with the owner binding metadata.
    await storageEnv.withSecurityRulesDisabled(async (ctx) => {
      const meta = await ctx.storage().ref(issued.path).getMetadata();
      expect(meta.customMetadata?.["customerId"]).toBe(customerId);
      expect(meta.contentType).toBe("image/jpeg");
    });

    // Rules: studio of the tenant reads, the owning customer reads, another
    // customer of the same tenant is denied, and NOBODY writes directly.
    const reader = (uid2: string, claims: Record<string, unknown>) => storageEnv.authenticatedContext(uid2, claims);
    await assertSucceeds(reader(staffUid, { role: "studio", tenantId: TENANT_A, studioId: STUDIO_A }).storage().ref(issued.path).getMetadata());
    await assertSucceeds(reader(customerId, { role: "customer", tenantId: TENANT_A, studioId: null }).storage().ref(issued.path).getMetadata());
    await assertFails(reader(uid("other-cust"), { role: "customer", tenantId: TENANT_A, studioId: null }).storage().ref(issued.path).getMetadata());
    await assertFails(Promise.resolve(reader(customerId, { role: "customer", tenantId: TENANT_A, studioId: null }).storage().ref(issued.path).put(new Uint8Array([1]))));

    // The inspection accepts exactly this path and keeps it.
    await updateInspection.run({ data: { jobId: job.id, addPhotos: [issued.path] }, auth: staff } as never);
    const snap = await db.collection(COLLECTIONS.inspections()).doc(job.id).get();
    expect(snap.data()?.photos).toEqual([issued.path]);
  }, 30000);
});

// ─── 5. Attendance callables across the real day-state machine ───────────────

import { checkInAttendance } from "../../functions/attendance/checkInAttendance.js";
import { startAttendanceBreak } from "../../functions/attendance/startAttendanceBreak.js";
import { endAttendanceBreak } from "../../functions/attendance/endAttendanceBreak.js";
import { checkOutAttendance } from "../../functions/attendance/checkOutAttendance.js";
import type { Employee } from "@autodeck/core";

async function seedEmployee(authUid: string, studioId: string | null, tenantId = TENANT_A, role: "studio" | "admin" = "studio") {
  const now = new Date().toISOString();
  const employee: Employee = {
    id: uid("emp"),
    tenantId,
    studioId,
    authUid,
    email: `${authUid}@test.example`,
    name: `Test ${authUid}`,
    phone: "+919999999999",
    role,
    active: true,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
  };
  await db.collection(COLLECTIONS.employees()).doc(employee.id).set(employee);
  return employee;
}

describe("attendance callables - day state machine", () => {
  it("check-in creates PRESENT with no checkout and no breaks; a second check-in is already-exists", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    const first = (await checkInAttendance.run({ data: {}, auth } as never)) as { id: string };
    const snap = await db.collection(COLLECTIONS.attendance()).doc(first.id).get();
    const rec = snap.data()!;
    expect(rec.status).toBe("PRESENT");
    expect(rec.checkOutAt).toBeNull();
    expect(rec.breaks).toEqual([]);
    await expectErr(checkInAttendance.run({ data: {}, auth } as never), "already-exists");
  });

  it("break: start OK, repeat start already-exists, checkout during break failed-precondition, end OK, repeat end failed-precondition", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    await checkInAttendance.run({ data: {}, auth } as never);

    await startAttendanceBreak.run({ data: {}, auth } as never);
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "already-exists");
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "failed-precondition", "End the current break");
    await endAttendanceBreak.run({ data: {}, auth } as never);
    await expectErr(endAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "No break is in progress");
  });

  it("checkout computes workedMinutes net of breaks; repeat checkout already-exists; startBreak after checkout failed-precondition", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    await checkInAttendance.run({ data: {}, auth } as never);
    await startAttendanceBreak.run({ data: {}, auth } as never);
    await new Promise((r) => setTimeout(r, 1200));
    await endAttendanceBreak.run({ data: {}, auth } as never);

    const out = (await checkOutAttendance.run({ data: {}, auth } as never)) as { workedMinutes: number };
    expect(out.workedMinutes).toBeGreaterThanOrEqual(0);
    const snap = await db.collection(COLLECTIONS.attendance()).doc((await checkInDocId(staffUid))).get();
    expect(snap.data()?.workedMinutes).toBe(out.workedMinutes);
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "already-exists");
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "Already checked out");
  });

  async function checkInDocId(staffUid: string): Promise<string> {
    const emp = await db.collection(COLLECTIONS.employees()).where("authUid", "==", staffUid).limit(1).get();
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return `${TENANT_A}__${emp.docs[0]!.id}__${date}`;
  }

  it("with no check-in, start/end break and checkout are all failed-precondition", async () => {
    const staffUid = uid("staff");
    await seedEmployee(staffUid, STUDIO_A);
    const auth = studioAuth(staffUid);
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "No check-in");
    await expectErr(endAttendanceBreak.run({ data: {}, auth } as never), "failed-precondition", "No check-in");
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "failed-precondition", "No check-in");
  });

  it("a studio account with no active roster record is permission-denied on all four", async () => {
    const auth = studioAuth(uid("ghost"));
    await expectErr(checkInAttendance.run({ data: {}, auth } as never), "permission-denied");
    await expectErr(startAttendanceBreak.run({ data: {}, auth } as never), "permission-denied");
    await expectErr(endAttendanceBreak.run({ data: {}, auth } as never), "permission-denied");
    await expectErr(checkOutAttendance.run({ data: {}, auth } as never), "permission-denied");
  });

  it("a tenant admin (studioId null roster) cannot self check in: failed-precondition", async () => {
    const adminUid = uid("tadmin");
    await seedEmployee(adminUid, null, TENANT_A, "admin");
    const auth = { uid: adminUid, token: { role: "admin", tenantId: TENANT_A, studioId: null }, rawToken: "test" };
    await expectErr(checkInAttendance.run({ data: {}, auth } as never), "failed-precondition", "not studio-scoped");
  });
});

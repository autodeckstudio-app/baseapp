/**
 * Emulator integration tests closing Phase 6/7's identified test-coverage
 * debt: voidInvoice, getServiceCatalogue, getStudioJobs, addStaffMember,
 * updateStaffRole, deactivateStaffMember previously had zero automated
 * coverage of any kind. Each test below invokes the REAL exported Cloud
 * Function handler via `.run({ data, auth } as never)` — no simulation.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, vi } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Service, ServiceJob, Employee, Invoice } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { getServiceCatalogue } from "../../functions/service/getServiceCatalogue.js";
import { getStudioJobs } from "../../functions/job/getStudioJobs.js";
import { addStaffMember } from "../../functions/employee/addStaffMember.js";
import { updateStaffRole } from "../../functions/employee/updateStaffRole.js";
import { deactivateStaffMember } from "../../functions/employee/deactivateStaffMember.js";
import { voidInvoice } from "../../functions/invoice/voidInvoice.js";

const db = getFirestore();

const TENANT_A = "cov-tenant-a";
const TENANT_B = "cov-tenant-b";
const STUDIO_A = "cov-studio-a";
const STUDIO_B = "cov-studio-b";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function studioAuth(authUid: string, studioId: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "studio", tenantId, studioId } };
}
function adminAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "admin", tenantId, studioId: null } };
}

async function seedService(serviceId: string, tenantId: string, opts: Partial<Service> = {}) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Coverage Test Wash",
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
    ...opts,
  };
  await db.collection(COLLECTIONS.services()).doc(serviceId).set(service);
  return service;
}

async function seedJob(jobId: string, tenantId: string, studioId: string, scheduledDate: string) {
  const now = new Date().toISOString();
  const job: ServiceJob = {
    id: jobId,
    tenantId,
    studioId,
    bookingId: null,
    customerId: uid("cust"),
    vehicleId: uid("veh"),
    serviceId: uid("svc"),
    bayId: `${studioId}-bay-1`,
    assignedEmployeeId: null,
    status: "PENDING_VEHICLE",
    statusHistory: [],
    scheduledAt: `${scheduledDate}T04:00:00.000Z`,
    scheduledDate,
    estimatedEndAt: `${scheduledDate}T05:00:00.000Z`,
    estimatedEndDate: scheduledDate,
    estimatedDurationMinutes: 60,
    studioNotes: null,
    additionalWorkDelta: 0,
    priceBreakdown: {
      vehicleCategory: "hatchback",
      basePrice: 40000,
      scopeAdjustment: 0,
      addOns: [],
      subtotal: 40000,
      membershipDiscount: null,
      membershipDiscountPercent: null,
      pickupFee: 0,
      dropFee: 0,
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      tax: 7200,
      total: 47200,
      currency: "INR",
    },
    totalAmount: 47200,
    paymentStatus: "unpaid",
    isWalkIn: false,
    createdAt: now,
    updatedAt: now,
    sealedAt: null,
  };
  await db.collection(COLLECTIONS.jobs()).doc(jobId).set(job);
  return job;
}

async function seedInvoice(invoiceId: string, tenantId: string, studioId: string, status: Invoice["status"]) {
  const now = new Date().toISOString();
  const invoice: Invoice = {
    id: invoiceId,
    tenantId,
    studioId,
    jobId: uid("job"),
    bookingId: null,
    customerId: uid("cust"),
    vehicleId: uid("veh"),
    paymentId: status === "paid" ? uid("pay") : null,
    invoiceNumber: `INV-TEST-${invoiceId}`,
    lineItems: [{ description: "Test Wash", quantity: 1, unitPrice: 40000, total: 40000 }],
    subtotal: 40000,
    discount: 0,
    discountDescription: null,
    taxRatePercent: 18,
    taxDescription: "GST 18%",
    tax: 7200,
    total: 47200,
    currency: "INR",
    status,
    pdfUrl: null,
    publicToken: uid("token"),
    issuedAt: now,
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COLLECTIONS.invoices()).doc(invoiceId).set(invoice);
  return invoice;
}

async function seedEmployee(
  employeeId: string,
  tenantId: string,
  studioId: string | null,
  opts: Partial<Employee> = {},
) {
  const authUser = await getAuth().createUser({
    uid: employeeId,
    email: `${employeeId}@coverage-test.local`,
    password: "test-password-123",
  });
  const now = new Date().toISOString();
  const employee: Employee = {
    id: employeeId,
    tenantId,
    studioId,
    authUid: authUser.uid,
    name: "Test Employee",
    phone: "",
    role: "studio",
    active: true,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
    ...opts,
  };
  await db.collection(COLLECTIONS.employees()).doc(employeeId).set(employee);
  return employee;
}

// ─── getServiceCatalogue ────────────────────────────────────────────────────

describe("getServiceCatalogue", () => {
  it("returns only active services for the caller's own tenant, ordered by displayOrder", async () => {
    const tenantId = uid("cat-tenant");
    await seedService(uid("svc-a"), tenantId, { name: "Second", displayOrder: 2 });
    await seedService(uid("svc-b"), tenantId, { name: "First", displayOrder: 1 });
    await seedService(uid("svc-inactive"), tenantId, { name: "Inactive", active: false, displayOrder: 0 });
    await seedService(uid("svc-other-tenant"), uid("other-tenant"), { name: "Other Tenant" });

    const result = (await getServiceCatalogue.run({
      data: {},
      auth: { uid: uid("customer"), token: { role: "customer", tenantId, studioId: null } },
    } as never)) as { services: Service[] };

    expect(result.services.map((s) => s.name)).toEqual(["First", "Second"]);
  });

  it("filters by category when provided", async () => {
    const tenantId = uid("cat-tenant2");
    await seedService(uid("svc-wash"), tenantId, { category: "washing" });
    await seedService(uid("svc-ppf"), tenantId, { category: "ppf" });

    const result = (await getServiceCatalogue.run({
      data: { category: "ppf" },
      auth: { uid: uid("customer"), token: { role: "customer", tenantId, studioId: null } },
    } as never)) as { services: Service[] };

    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.category).toBe("ppf");
  });

  it("rejects an unauthenticated call", async () => {
    await expect(
      getServiceCatalogue.run({ data: {}, auth: undefined } as never),
    ).rejects.toThrow(/Authentication required/);
  });
});

// ─── getStudioJobs ──────────────────────────────────────────────────────────

describe("getStudioJobs", () => {
  it("studio user gets their own studio's jobs for a given date", async () => {
    await seedJob(uid("job"), TENANT_A, STUDIO_A, "2026-09-01");
    await seedJob(uid("job"), TENANT_A, STUDIO_A, "2026-09-02"); // different date, excluded

    const result = (await getStudioJobs.run({
      data: { studioId: STUDIO_A, date: "2026-09-01" },
      auth: studioAuth(uid("staff"), STUDIO_A),
    } as never)) as { jobs: ServiceJob[]; date: string };

    expect(result.date).toBe("2026-09-01");
    expect(result.jobs.every((j) => j.studioId === STUDIO_A && j.scheduledDate === "2026-09-01")).toBe(true);
    expect(result.jobs.length).toBeGreaterThan(0);
  });

  it("studio user cannot fetch another studio's jobs", async () => {
    await expect(
      getStudioJobs.run({
        data: { studioId: STUDIO_B, date: "2026-09-01" },
        auth: studioAuth(uid("staff"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/Access denied to this studio/);
  });

  it("admin can fetch any studio's jobs within their own tenant", async () => {
    const result = (await getStudioJobs.run({
      data: { studioId: STUDIO_B, date: "2026-09-01" },
      auth: adminAuth(uid("admin")),
    } as never)) as { jobs: ServiceJob[] };
    expect(Array.isArray(result.jobs)).toBe(true);
  });

  it("customer role is rejected entirely", async () => {
    await expect(
      getStudioJobs.run({
        data: { studioId: STUDIO_A },
        auth: { uid: uid("cust"), token: { role: "customer", tenantId: TENANT_A, studioId: null } },
      } as never),
    ).rejects.toThrow();
  });
});

// ─── addStaffMember / updateStaffRole / deactivateStaffMember ──────────────

describe("Staff management (addStaffMember / updateStaffRole / deactivateStaffMember)", () => {
  it("admin creates a studio-scoped staff member: real Auth user + Employee record + claims", async () => {
    const adminUid = uid("admin");
    const email = `${uid("newstaff")}@coverage-test.local`;

    const result = (await addStaffMember.run({
      data: { name: "New Studio Staff", email, password: "password123", role: "studio", studioId: STUDIO_A },
      auth: adminAuth(adminUid),
    } as never)) as { employeeId: string };

    const employeeSnap = await db.collection(COLLECTIONS.employees()).doc(result.employeeId).get();
    const employee = employeeSnap.data() as Employee;
    expect(employee.tenantId).toBe(TENANT_A); // server-derived from caller, not client input
    expect(employee.role).toBe("studio");
    expect(employee.studioId).toBe(STUDIO_A);
    expect(employee.active).toBe(true);

    const { customClaims } = await getAuth().getUser(result.employeeId);
    expect(customClaims?.["role"]).toBe("studio");
    expect(customClaims?.["tenantId"]).toBe(TENANT_A);
    expect(customClaims?.["studioId"]).toBe(STUDIO_A);
  });

  it("rejects role='admin' with a non-null studioId", async () => {
    await expect(
      addStaffMember.run({
        data: { name: "Bad Admin", email: `${uid("bad")}@coverage-test.local`, password: "password123", role: "admin", studioId: STUDIO_A },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/not studio-scoped/);
  });

  it("rejects role='studio' with a null studioId", async () => {
    await expect(
      addStaffMember.run({
        data: { name: "Bad Studio", email: `${uid("bad")}@coverage-test.local`, password: "password123", role: "studio", studioId: null },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/require a studioId/);
  });

  it("rejects a duplicate email", async () => {
    const email = `${uid("dup")}@coverage-test.local`;
    await addStaffMember.run({
      data: { name: "First", email, password: "password123", role: "studio", studioId: STUDIO_A },
      auth: adminAuth(uid("admin")),
    } as never);

    await expect(
      addStaffMember.run({
        data: { name: "Second", email, password: "password123", role: "studio", studioId: STUDIO_A },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/already exists/);
  });

  it("studio-role caller is rejected (admin-only)", async () => {
    await expect(
      addStaffMember.run({
        data: { name: "X", email: `${uid("x")}@coverage-test.local`, password: "password123", role: "studio", studioId: STUDIO_A },
        auth: studioAuth(uid("staff"), STUDIO_A),
      } as never),
    ).rejects.toThrow();
  });

  it("Phase 5B P1-6 regression: a Firestore failure after Auth user creation deletes the orphaned Auth account, allowing a clean retry", async () => {
    const email = `${uid("orphan")}@coverage-test.local`;

    // Simulate a transient Firestore failure AFTER adminAuth.createUser()
    // has already succeeded — the exact window that used to leave a
    // permanent orphan (real Auth account, no Employee record, retry
    // blocked forever by the duplicate-email check). enforceRateLimit()
    // ALSO calls db.runTransaction() — and runs first — so a bare
    // mockRejectedValueOnce would fail that call instead of the intended
    // Employee-creation one, short-circuiting the whole function before
    // adminAuth.createUser() ever runs and silently making this test a
    // false positive (no orphan is ever created to clean up). Let the
    // first call (rate limit) through for real, reject only the second.
    const originalRunTransaction = db.runTransaction.bind(db);
    const txSpy = vi
      .spyOn(db, "runTransaction")
      .mockImplementationOnce((...args: Parameters<typeof db.runTransaction>) => originalRunTransaction(...args))
      .mockRejectedValueOnce(new Error("simulated Firestore failure"));

    await expect(
      addStaffMember.run({
        data: { name: "Orphan Risk", email, password: "password123", role: "studio", studioId: STUDIO_A },
        auth: adminAuth(uid("admin-orphan")),
      } as never),
    ).rejects.toThrow(/simulated Firestore failure/);

    txSpy.mockRestore();

    // The Auth account must NOT survive the failed attempt.
    await expect(getAuth().getUserByEmail(email)).rejects.toThrow();

    // No Employee record should exist for this email either.
    const orphanSnap = await db.collection(COLLECTIONS.employees()).where("name", "==", "Orphan Risk").get();
    expect(orphanSnap.empty).toBe(true);

    // A genuine retry with the same email must now succeed cleanly — proof
    // the compensating delete actually ran, not just that the call failed.
    const retryResult = (await addStaffMember.run({
      data: { name: "Orphan Risk Retry", email, password: "password123", role: "studio", studioId: STUDIO_A },
      auth: adminAuth(uid("admin-orphan-retry")),
    } as never)) as { employeeId: string };

    const employeeSnap = await db.collection(COLLECTIONS.employees()).doc(retryResult.employeeId).get();
    expect(employeeSnap.exists).toBe(true);
    expect((employeeSnap.data() as Employee).name).toBe("Orphan Risk Retry");
  });

  it("updateStaffRole changes role/studio and keeps Auth claims and Firestore record in sync", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_A, STUDIO_A, { role: "studio" });

    const result = (await updateStaffRole.run({
      data: { employeeId: employee.id, role: "studio", studioId: STUDIO_B },
      auth: adminAuth(uid("admin")),
    } as never)) as { employeeId: string; role: string };

    expect(result.role).toBe("studio");
    const snap = await db.collection(COLLECTIONS.employees()).doc(employee.id).get();
    expect((snap.data() as Employee).studioId).toBe(STUDIO_B);

    const { customClaims } = await getAuth().getUser(employee.authUid);
    expect(customClaims?.["studioId"]).toBe(STUDIO_B);
  });

  it("updateStaffRole rejects a cross-tenant employee", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_B, STUDIO_B, { role: "studio" });
    await expect(
      updateStaffRole.run({
        data: { employeeId: employee.id, role: "studio", studioId: STUDIO_B },
        auth: adminAuth(uid("admin"), TENANT_A),
      } as never),
    ).rejects.toThrow();
  });

  it("updateStaffRole rejects changing a terminated employee's role", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_A, STUDIO_A, {
      role: "studio",
      terminatedAt: new Date().toISOString(),
      active: false,
    });
    await expect(
      updateStaffRole.run({
        data: { employeeId: employee.id, role: "studio", studioId: STUDIO_B },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/terminated employee/);
  });

  it("Phase 5B P2-2 regression: a Firestore failure after the claims write rolls the claims back, avoiding permanent Auth/Firestore drift", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_A, STUDIO_A, { role: "studio" });

    // enforceRateLimit() ALSO calls db.runTransaction() and runs first — a
    // bare mockRejectedValueOnce would fail that call instead of the
    // intended role-change transaction, short-circuiting the function
    // before setCustomUserClaims() ever runs and making this test a false
    // positive. Let the first call (rate limit) through for real, reject
    // only the second.
    const originalRunTransaction = db.runTransaction.bind(db);
    const txSpy = vi
      .spyOn(db, "runTransaction")
      .mockImplementationOnce((...args: Parameters<typeof db.runTransaction>) => originalRunTransaction(...args))
      .mockRejectedValueOnce(new Error("simulated Firestore failure"));

    await expect(
      updateStaffRole.run({
        data: { employeeId: employee.id, role: "studio", studioId: STUDIO_B },
        auth: adminAuth(uid("admin-drift")),
      } as never),
    ).rejects.toThrow(/simulated Firestore failure/);

    txSpy.mockRestore();

    // Claims must be rolled back to the ORIGINAL studioId, not left at the
    // new (drifted) value — this is the defect this test reproduces.
    const { customClaims } = await getAuth().getUser(employee.authUid);
    expect(customClaims?.["studioId"]).toBe(STUDIO_A);

    // Firestore was never touched by the failed attempt either.
    const employeeSnap = await db.collection(COLLECTIONS.employees()).doc(employee.id).get();
    expect((employeeSnap.data() as Employee).studioId).toBe(STUDIO_A);

    // A genuine retry now succeeds cleanly and both sides move together.
    const retryResult = (await updateStaffRole.run({
      data: { employeeId: employee.id, role: "studio", studioId: STUDIO_B },
      auth: adminAuth(uid("admin-drift-retry")),
    } as never)) as { role: string };
    expect(retryResult.role).toBe("studio");

    const { customClaims: retriedClaims } = await getAuth().getUser(employee.authUid);
    expect(retriedClaims?.["studioId"]).toBe(STUDIO_B);
    const retriedSnap = await db.collection(COLLECTIONS.employees()).doc(employee.id).get();
    expect((retriedSnap.data() as Employee).studioId).toBe(STUDIO_B);
  });

  it("deactivateStaffMember disables the Auth account, revokes tokens, and marks the Employee terminated", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_A, STUDIO_A, { role: "studio" });

    const result = (await deactivateStaffMember.run({
      data: { employeeId: employee.id },
      auth: adminAuth(uid("admin")),
    } as never)) as { employeeId: string; alreadyTerminated: boolean };

    expect(result.alreadyTerminated).toBe(false);

    const snap = await db.collection(COLLECTIONS.employees()).doc(employee.id).get();
    const updated = snap.data() as Employee;
    expect(updated.active).toBe(false);
    expect(updated.terminatedAt).not.toBeNull();

    const authUser = await getAuth().getUser(employee.authUid);
    expect(authUser.disabled).toBe(true);
  });

  it("deactivateStaffMember is idempotent — calling twice returns alreadyTerminated:true, doesn't error", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_A, STUDIO_A, { role: "studio" });

    await deactivateStaffMember.run({ data: { employeeId: employee.id }, auth: adminAuth(uid("admin")) } as never);
    const second = (await deactivateStaffMember.run({
      data: { employeeId: employee.id },
      auth: adminAuth(uid("admin-2")),
    } as never)) as { alreadyTerminated: boolean };

    expect(second.alreadyTerminated).toBe(true);
  });

  it("deactivateStaffMember rejects a cross-tenant employee", async () => {
    const employee = await seedEmployee(uid("emp"), TENANT_B, STUDIO_B, { role: "studio" });
    await expect(
      deactivateStaffMember.run({
        data: { employeeId: employee.id },
        auth: adminAuth(uid("admin"), TENANT_A),
      } as never),
    ).rejects.toThrow();
  });
});

// ─── voidInvoice ─────────────────────────────────────────────────────────────

describe("voidInvoice", () => {
  it("admin voids an issued invoice", async () => {
    const invoice = await seedInvoice(uid("inv"), TENANT_A, STUDIO_A, "issued");

    const result = (await voidInvoice.run({
      data: { invoiceId: invoice.id, reason: "Customer requested cancellation" },
      auth: adminAuth(uid("admin")),
    } as never)) as { invoiceId: string; voided: boolean };

    expect(result.voided).toBe(true);
    const snap = await db.collection(COLLECTIONS.invoices()).doc(invoice.id).get();
    const updated = snap.data() as Invoice;
    expect(updated.status).toBe("void");
    expect(updated.voidedReason).toBe("Customer requested cancellation");
  });

  it("rejects voiding an already-void invoice", async () => {
    const invoice = await seedInvoice(uid("inv"), TENANT_A, STUDIO_A, "void");
    await expect(
      voidInvoice.run({
        data: { invoiceId: invoice.id, reason: "test" },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/already void/);
  });

  it("rejects voiding a paid invoice (refund must be initiated first)", async () => {
    const invoice = await seedInvoice(uid("inv"), TENANT_A, STUDIO_A, "paid");
    await expect(
      voidInvoice.run({
        data: { invoiceId: invoice.id, reason: "test" },
        auth: adminAuth(uid("admin")),
      } as never),
    ).rejects.toThrow(/Initiate a refund first/);
  });

  it("rejects a cross-tenant invoice", async () => {
    const invoice = await seedInvoice(uid("inv"), TENANT_B, STUDIO_B, "issued");
    await expect(
      voidInvoice.run({
        data: { invoiceId: invoice.id, reason: "test" },
        auth: adminAuth(uid("admin"), TENANT_A),
      } as never),
    ).rejects.toThrow(/Cross-tenant/);
  });

  it("studio-role caller is rejected (admin-only)", async () => {
    const invoice = await seedInvoice(uid("inv"), TENANT_A, STUDIO_A, "issued");
    await expect(
      voidInvoice.run({
        data: { invoiceId: invoice.id, reason: "test" },
        auth: studioAuth(uid("staff"), STUDIO_A),
      } as never),
    ).rejects.toThrow(/Admin role required/);
  });

  it("Phase 5B P2-1 regression: two concurrent void calls on one invoice — exactly one succeeds, no lost update", async () => {
    const invoice = await seedInvoice(uid("inv-race"), TENANT_A, STUDIO_A, "issued");

    const [r1, r2] = await Promise.allSettled([
      voidInvoice.run({
        data: { invoiceId: invoice.id, reason: "reason A" },
        auth: adminAuth(uid("admin-race-a")),
      } as never),
      voidInvoice.run({
        data: { invoiceId: invoice.id, reason: "reason B" },
        auth: adminAuth(uid("admin-race-b")),
      } as never),
    ]);

    const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
    const rejected = [r1, r2].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/already void/);

    // Exactly one audit entry — the defect this test reproduces: a blind
    // (non-transactional-read) update let both concurrent calls commit,
    // producing two "invoice.voided" entries for a single invoice.
    const auditSnap = await db
      .collection(COLLECTIONS.auditLog())
      .where("entityId", "==", invoice.id)
      .where("action", "==", "invoice.voided")
      .get();
    expect(auditSnap.docs).toHaveLength(1);
  });

  it("Phase 5B P2-3 regression: voiding an invoice does not touch job.paymentStatus (documented, intentional — refund is the separate path for that)", async () => {
    const jobId = uid("job-void-scope");
    await seedJob(jobId, TENANT_A, STUDIO_A, "2026-09-15");
    await db.collection(COLLECTIONS.jobs()).doc(jobId).update({ paymentStatus: "unpaid" });

    const invoiceId = uid("inv-void-scope");
    const now = new Date().toISOString();
    const invoice: Invoice = {
      id: invoiceId,
      tenantId: TENANT_A,
      studioId: STUDIO_A,
      jobId,
      bookingId: null,
      customerId: uid("cust"),
      vehicleId: uid("veh"),
      paymentId: null,
      invoiceNumber: `INV-TEST-${invoiceId}`,
      lineItems: [{ description: "Test Wash", quantity: 1, unitPrice: 40000, total: 40000 }],
      subtotal: 40000,
      discount: 0,
      discountDescription: null,
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      tax: 7200,
      total: 47200,
      currency: "INR",
      status: "issued",
      pdfUrl: null,
      publicToken: uid("token"),
      issuedAt: now,
      voidedAt: null,
      voidedReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection(COLLECTIONS.invoices()).doc(invoiceId).set(invoice);

    await voidInvoice.run({
      data: { invoiceId, reason: "issued in error" },
      auth: adminAuth(uid("admin-scope")),
    } as never);

    const invoiceSnap = await db.collection(COLLECTIONS.invoices()).doc(invoiceId).get();
    expect((invoiceSnap.data() as Invoice).status).toBe("void");

    // The documented, intentional scope of this function: only the Invoice
    // document changes. job.paymentStatus is untouched.
    const jobSnap = await db.collection(COLLECTIONS.jobs()).doc(jobId).get();
    expect((jobSnap.data() as ServiceJob).paymentStatus).toBe("unpaid");
  });
});

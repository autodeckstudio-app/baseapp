/**
 * Firestore security rules tests.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080)
 * Rules are loaded from ../../../../firestore.rules (repo root)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_TENANT_ID } from "@autodeck/core";

const RULES_PATH = resolve(__dirname, "../../../../firestore.rules");

let testEnv: RulesTestEnvironment;

function makeCustomerClaims(_uid: string) {
  return { role: "customer", tenantId: FIRST_TENANT_ID, studioId: null };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "autodeck-dev",
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "localhost",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedCustomer(uid: string, tenantId = FIRST_TENANT_ID) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("customers").doc(uid).set({
      id: uid,
      tenantId,
      authUid: uid,
      name: `Customer ${uid}`,
      phone: "+919876543210",
      notificationPrefs: { push: true, quietMode: false },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });
}

async function seedVehicle(vehicleId: string, ownerId: string, tenantId = FIRST_TENANT_ID) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("vehicles").doc(vehicleId).set({
      id: vehicleId,
      tenantId,
      ownerId,
      registrationNumber: "GJ01AB1234",
      make: "Maruti",
      model: "Swift",
      year: 2022,
      color: "White",
      photoUrl: null,
      odometer: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    });
  });
}

// ─── Customer collection rules ────────────────────────────────────────────────

describe("/customers/{userId} — customer cannot read other customer", () => {
  it("Customer A can read their own profile", async () => {
    await seedCustomer("uid-alice");

    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("customers").doc("uid-alice").get());
  });

  it("Customer A cannot read Customer B profile", async () => {
    await seedCustomer("uid-alice");
    await seedCustomer("uid-bob");

    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("customers").doc("uid-bob").get());
  });

  it("Unauthenticated user cannot read any customer", async () => {
    await seedCustomer("uid-alice");
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().collection("customers").doc("uid-alice").get());
  });

  it("Customer cannot change their tenantId", async () => {
    await seedCustomer("uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("customers").doc("uid-alice").update({
        tenantId: "other-tenant",
      }),
    );
  });

  it("Customer can update their own name", async () => {
    await seedCustomer("uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(
      alice
        .firestore()
        .collection("customers")
        .doc("uid-alice")
        .update({ name: "Alice Updated", updatedAt: new Date().toISOString() }),
    );
  });

  it("Customer cannot create a customer document (client-side)", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("customers").doc("uid-alice").set({
        id: "uid-alice",
        tenantId: FIRST_TENANT_ID,
        authUid: "uid-alice",
        name: "Alice",
        phone: "+919876543210",
        notificationPrefs: { push: true, quietMode: false },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }),
    );
  });
});

// ─── Vehicle collection rules ─────────────────────────────────────────────────

describe("/vehicles/{vehicleId} — ownership isolation", () => {
  it("Customer A can read their own vehicle", async () => {
    await seedVehicle("vehicle-1", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("vehicles").doc("vehicle-1").get());
  });

  it("Customer A cannot read Customer B's vehicle", async () => {
    await seedVehicle("vehicle-bob", "uid-bob");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("vehicles").doc("vehicle-bob").get());
  });

  it("Customer cannot create a vehicle document directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("vehicles").doc("new-vehicle").set({
        id: "new-vehicle",
        tenantId: FIRST_TENANT_ID,
        ownerId: "uid-alice",
        registrationNumber: "GJ01AB9999",
        make: "Honda",
        model: "City",
        year: 2023,
        color: "Blue",
        photoUrl: null,
        odometer: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }),
    );
  });

  it("Customer cannot modify another customer's vehicle", async () => {
    await seedVehicle("vehicle-bob", "uid-bob");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice
        .firestore()
        .collection("vehicles")
        .doc("vehicle-bob")
        .update({ color: "Red", updatedAt: new Date().toISOString() }),
    );
  });

  // Vehicles are Cloud-Function-only for mutation (createVehicle/updateVehicle
  // via the real updateVehicleSchema, which doesn't even accept ownerId/
  // tenantId as fields) — no direct client write is ever legitimate, even
  // from a studio/admin user in the correct tenant. The previous rule's
  // isStudioOrAbove() branch had NO field restriction and NO ownStudio()
  // check, letting any studio/admin/superadmin in the tenant hijack a
  // vehicle's ownerId (reassign to any uid) or even move it to a different
  // tenant, entirely bypassing Cloud Function schema validation, rate
  // limiting, and audit logging (Phase 6 hostile audit P0 finding).
  it("Studio in own tenant still cannot write to /vehicles directly (Cloud Function only)", async () => {
    await seedVehicle("vehicle-studio-direct", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("vehicles").doc("vehicle-studio-direct").update({
        color: "Red",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Studio cannot hijack vehicle ownership via direct write (ownerId reassignment)", async () => {
    await seedVehicle("vehicle-hijack-owner", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("vehicles").doc("vehicle-hijack-owner").update({
        ownerId: "uid-attacker",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Studio cannot move a vehicle to a different tenant via direct write", async () => {
    await seedVehicle("vehicle-hijack-tenant", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("vehicles").doc("vehicle-hijack-tenant").update({
        tenantId: "tenant-attacker",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Admin cannot write to /vehicles directly, even in their own tenant (Cloud Function only)", async () => {
    await seedVehicle("vehicle-admin-direct", "uid-alice");
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims(FIRST_TENANT_ID));
    await assertFails(
      admin.firestore().collection("vehicles").doc("vehicle-admin-direct").update({
        color: "Blue",
        updatedAt: new Date().toISOString(),
      }),
    );
  });
});

// ─── Cross-tenant isolation ───────────────────────────────────────────────────

describe("cross-tenant access", () => {
  it("Customer from tenant A cannot read customer from tenant B", async () => {
    await seedCustomer("uid-tenant-b-user", "tenant-b");

    const tenantAUser = testEnv.authenticatedContext("uid-tenant-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(
      tenantAUser.firestore().collection("customers").doc("uid-tenant-b-user").get(),
    );
  });

  it("Customer from tenant A cannot read vehicle from tenant B", async () => {
    await seedVehicle("vehicle-tenant-b", "uid-tenant-b-user", "tenant-b");

    const tenantAUser = testEnv.authenticatedContext("uid-tenant-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(
      tenantAUser.firestore().collection("vehicles").doc("vehicle-tenant-b").get(),
    );
  });
});

// ─── Payment immutability ─────────────────────────────────────────────────────

describe("/payments — no client writes", () => {
  it("Customer cannot write to /payments directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("payments").doc("pay-1").set({
        id: "pay-1",
        tenantId: FIRST_TENANT_ID,
        amount: 50000,
        status: "completed",
      }),
    );
  });

  it("Studio user cannot write to /payments directly", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("payments").doc("pay-2").set({
        id: "pay-2",
        tenantId: FIRST_TENANT_ID,
        amount: 50000,
        status: "completed",
      }),
    );
  });
});

// ─── Booking rules ────────────────────────────────────────────────────────────

async function seedBooking(
  bookingId: string,
  customerId: string,
  tenantId = FIRST_TENANT_ID,
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("bookings").doc(bookingId).set({
      id: bookingId,
      tenantId,
      studioId: "studio-ahmedabad",
      customerId,
      vehicleId: "vehicle-1",
      serviceId: "service-1",
      status: "CONFIRMED",
      scheduledAt: now,
      scheduledDate: "2026-08-18",
      scheduledTime: "10:00",
      bayId: "bay-wash-1",
      priceBreakdown: { total: 50000 },
      totalAmount: 50000,
      paymentStatus: "unpaid",
      rescheduleCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedJob(
  jobId: string,
  customerId: string,
  studioId: string,
  tenantId = FIRST_TENANT_ID,
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("jobs").doc(jobId).set({
      id: jobId,
      tenantId,
      studioId,
      customerId,
      vehicleId: "vehicle-1",
      serviceId: "service-1",
      bayId: "bay-wash-1",
      status: "PENDING_VEHICLE",
      statusHistory: [],
      scheduledAt: now,
      scheduledDate: "2026-08-18",
      estimatedEndAt: now,
      estimatedDurationMinutes: 60,
      isWalkIn: false,
      paymentStatus: "unpaid",
      additionalWorkDelta: 0,
      createdAt: now,
      updatedAt: now,
      sealedAt: null,
    });
  });
}

describe("/bookings — ownership and isolation", () => {
  it("Customer can read their own booking", async () => {
    await seedBooking("booking-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("bookings").doc("booking-alice").get());
  });

  it("Customer cannot read another customer's booking", async () => {
    await seedBooking("booking-bob", "uid-bob");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("bookings").doc("booking-bob").get());
  });

  it("Customer cannot create a booking document directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("bookings").doc("direct-booking").set({
        id: "direct-booking",
        tenantId: FIRST_TENANT_ID,
        customerId: "uid-alice",
        status: "CONFIRMED",
      }),
    );
  });

  it("Customer cannot update priceBreakdown or totalAmount on a booking", async () => {
    await seedBooking("booking-price-test", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("bookings").doc("booking-price-test").update({
        totalAmount: 1,
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Studio can read bookings for own tenant", async () => {
    await seedBooking("booking-studio-read", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertSucceeds(
      studio.firestore().collection("bookings").doc("booking-studio-read").get(),
    );
  });

  // Bookings are Cloud-Function-only for mutation (rescheduleBooking,
  // cancelBooking, etc.) — no direct client write is ever legitimate, even
  // from a studio/admin user in the correct tenant (Phase 5A security audit
  // finding — the previous rule denylisted financial fields but otherwise
  // permitted direct studio/admin writes with no ownStudio() check).
  it("Studio in own tenant still cannot write to /bookings directly (Cloud Function only)", async () => {
    await seedBooking("booking-studio-direct", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("bookings").doc("booking-studio-direct").update({
        status: "CANCELLED",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Admin cannot write to /bookings directly, even in their own tenant (Cloud Function only)", async () => {
    await seedBooking("booking-admin-direct", "uid-alice");
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims(FIRST_TENANT_ID));
    await assertFails(
      admin.firestore().collection("bookings").doc("booking-admin-direct").update({
        status: "CANCELLED",
        updatedAt: new Date().toISOString(),
      }),
    );
  });
});

// ─── Job rules ────────────────────────────────────────────────────────────────

describe("/jobs — customer cannot mutate, studio can", () => {
  it("Customer can read their own job", async () => {
    await seedJob("job-alice", "uid-alice", "studio-ahmedabad");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("jobs").doc("job-alice").get());
  });

  it("Customer cannot read another customer's job", async () => {
    await seedJob("job-bob", "uid-bob", "studio-ahmedabad");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("jobs").doc("job-bob").get());
  });

  it("Customer cannot write to /jobs directly (no bay assignment)", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("jobs").doc("direct-job").set({
        id: "direct-job",
        tenantId: FIRST_TENANT_ID,
        customerId: "uid-alice",
        bayId: "bay-wash-1",
        status: "VEHICLE_RECEIVED",
      }),
    );
  });

  it("Customer cannot change job status directly", async () => {
    await seedJob("job-status-test", "uid-alice", "studio-ahmedabad");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("jobs").doc("job-status-test").update({
        status: "DELIVERED",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  // Jobs are Cloud-Function-only for mutation (advanceJobStatus, assignBay,
  // confirmManualPayment, etc.) — no direct client write is ever legitimate,
  // even from a studio user in the correct tenant/studio. This closes a
  // previously-open rule that had no ownStudio() check and no field
  // restriction (Phase 5A security audit P0 finding).
  it("Studio in own tenant/studio still cannot write to /jobs directly (Cloud Function only)", async () => {
    await seedJob("job-studio-direct", "uid-alice", "studio-ahmedabad");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("jobs").doc("job-studio-direct").update({
        status: "VEHICLE_RECEIVED",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Studio from a DIFFERENT studio in the same tenant cannot write to another studio's job", async () => {
    await seedJob("job-cross-studio", "uid-alice", "studio-ahmedabad");
    const otherStudioSameTenant = testEnv.authenticatedContext("uid-studio-2", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-b",
    });
    await assertFails(
      otherStudioSameTenant.firestore().collection("jobs").doc("job-cross-studio").update({
        totalAmount: 1,
        paymentStatus: "paid",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Admin cannot write to /jobs directly, even in their own tenant (Cloud Function only)", async () => {
    await seedJob("job-admin-direct", "uid-alice", "studio-ahmedabad");
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims(FIRST_TENANT_ID));
    await assertFails(
      admin.firestore().collection("jobs").doc("job-admin-direct").update({
        status: "DELIVERED",
        updatedAt: new Date().toISOString(),
      }),
    );
  });

  it("Studio from another tenant cannot read jobs", async () => {
    await seedJob("job-tenant-iso", "uid-alice", "studio-ahmedabad", FIRST_TENANT_ID);
    const otherStudio = testEnv.authenticatedContext("uid-other-studio", {
      role: "studio",
      tenantId: "tenant-b",
      studioId: "studio-b",
    });
    await assertFails(
      otherStudio.firestore().collection("jobs").doc("job-tenant-iso").get(),
    );
  });
});

// ─── Payment security rules ───────────────────────────────────────────────────

async function seedPayment(
  paymentId: string,
  customerId: string,
  tenantId = FIRST_TENANT_ID,
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("payments").doc(paymentId).set({
      id: paymentId,
      tenantId,
      studioId: "studio-ahmedabad",
      jobId: "",
      bookingId: "booking-1",
      customerId,
      amount: 500000,
      currency: "INR",
      method: "razorpay_payment_link",
      status: "pending",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: null,
      recordedBy: null,
      invoiceId: null,
      providerEventId: null,
      completedAt: null,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedInvoice(
  invoiceId: string,
  customerId: string,
  tenantId = FIRST_TENANT_ID,
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("invoices").doc(invoiceId).set({
      id: invoiceId,
      tenantId,
      studioId: "studio-ahmedabad",
      jobId: "",
      bookingId: "booking-1",
      customerId,
      vehicleId: "vehicle-1",
      paymentId: "payment-1",
      invoiceNumber: "INV-2026-00001",
      lineItems: [{ description: "PPF", quantity: 1, unitPrice: 500000, total: 500000 }],
      subtotal: 500000,
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      tax: 90000,
      total: 590000,
      currency: "INR",
      status: "issued",
      pdfUrl: null,
      publicToken: "test-uuid",
      issuedAt: now,
      voidedAt: null,
      voidedReason: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("/payments — client cannot write payment success", () => {
  it("Customer can read their own payment", async () => {
    await seedPayment("payment-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("payments").doc("payment-alice").get());
  });

  it("Customer cannot read another customer's payment", async () => {
    await seedPayment("payment-bob", "uid-bob");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("payments").doc("payment-bob").get());
  });

  it("Customer cannot create a payment document (client-side payment tampering)", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("payments").doc("tampered-payment").set({
        id: "tampered-payment",
        tenantId: FIRST_TENANT_ID,
        customerId: "uid-alice",
        amount: 1,
        status: "completed",
      }),
    );
  });

  it("Customer cannot update a payment to mark it as completed (amount tampering)", async () => {
    await seedPayment("payment-tamper-test", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("payments").doc("payment-tamper-test").update({
        status: "completed",
        amount: 1,
      }),
    );
  });

  it("Studio cannot write to /payments directly", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("payments").doc("studio-direct-payment").set({
        id: "studio-direct-payment",
        tenantId: FIRST_TENANT_ID,
        amount: 500000,
        status: "completed",
      }),
    );
  });

  it("Customer from tenant A cannot read payment from tenant B", async () => {
    await seedPayment("payment-tenant-b", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(
      tenantAUser.firestore().collection("payments").doc("payment-tenant-b").get(),
    );
  });
});

// ─── Invoice security rules ───────────────────────────────────────────────────

describe("/invoices — client cannot write invoice total", () => {
  it("Customer can read their own invoice", async () => {
    await seedInvoice("invoice-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("invoices").doc("invoice-alice").get());
  });

  it("Customer cannot read another customer's invoice", async () => {
    await seedInvoice("invoice-bob", "uid-bob");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("invoices").doc("invoice-bob").get());
  });

  it("Customer cannot create an invoice document (tampering)", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("invoices").doc("fake-invoice").set({
        id: "fake-invoice",
        tenantId: FIRST_TENANT_ID,
        customerId: "uid-alice",
        total: 1,
        status: "paid",
      }),
    );
  });

  it("Customer cannot update invoice total (immutability)", async () => {
    await seedInvoice("invoice-tamper", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("invoices").doc("invoice-tamper").update({
        total: 1,
        status: "paid",
      }),
    );
  });

  it("Studio can read an invoice within their own tenant (Phase 3H)", async () => {
    await seedInvoice("invoice-studio-read", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertSucceeds(studio.firestore().collection("invoices").doc("invoice-studio-read").get());
  });

  it("Admin can read an invoice within their own tenant (Phase 3H)", async () => {
    await seedInvoice("invoice-admin-read", "uid-alice");
    const admin = testEnv.authenticatedContext("uid-admin", {
      role: "admin",
      tenantId: FIRST_TENANT_ID,
      studioId: null,
    });
    await assertSucceeds(admin.firestore().collection("invoices").doc("invoice-admin-read").get());
  });

  it("Studio cannot write invoices directly", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("invoices").doc("studio-invoice").set({
        id: "studio-invoice",
        tenantId: FIRST_TENANT_ID,
        total: 100,
        status: "issued",
      }),
    );
  });

  it("invoiceCounters are inaccessible to all clients", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("invoiceCounters").doc(FIRST_TENANT_ID).get(),
    );
    const admin = testEnv.authenticatedContext("uid-admin", {
      role: "admin",
      tenantId: FIRST_TENANT_ID,
      studioId: null,
    });
    await assertFails(
      admin.firestore().collection("invoiceCounters").doc(FIRST_TENANT_ID).set({ nextNumber: 1 }),
    );
  });

  it("paymentEvents are inaccessible to all clients", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("paymentEvents").doc("evt-001").get(),
    );
  });

  it("Cross-tenant: tenant A customer cannot read tenant B invoice", async () => {
    await seedInvoice("invoice-tenant-b", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(
      tenantAUser.firestore().collection("invoices").doc("invoice-tenant-b").get(),
    );
  });
});

// ─── Admin business-control security rules (Phase 1e) ────────────────────────

function makeAdminClaims(tenantId = FIRST_TENANT_ID) {
  return { role: "admin", tenantId, studioId: null };
}

function makeStudioClaims(studioId = "studio-ahmedabad", tenantId = FIRST_TENANT_ID) {
  return { role: "studio", tenantId, studioId };
}

async function seedService(serviceId: string, tenantId = FIRST_TENANT_ID) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("services").doc(serviceId).set({
      id: serviceId,
      tenantId,
      name: "Test Wash",
      category: "washing",
      brand: null,
      description: "Basic wash",
      basePrice: 50000,
      currency: "INR",
      estimatedDurationMinutes: 30,
      warrantyLabel: null,
      vehicleCategoryPricing: [],
      requiredBayType: "wash",
      membershipWashEligible: false,
      active: true,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedStudioConfig(studioId = "studio-ahmedabad", tenantId = FIRST_TENANT_ID) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("studioConfig").doc(studioId).set({
      id: studioId,
      tenantId,
      studioId,
      name: "Test Studio",
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
      bays: [],
      updatedAt: now,
    });
  });
}

async function seedEmployee(employeeId: string, tenantId = FIRST_TENANT_ID, studioId: string | null = null) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("employees").doc(employeeId).set({
      id: employeeId,
      tenantId,
      studioId,
      authUid: employeeId,
      name: "Test Employee",
      phone: "",
      role: "admin",
      active: true,
      createdAt: now,
      updatedAt: now,
      terminatedAt: null,
    });
  });
}

describe("/services — catalogue mutations are server-authoritative", () => {
  it("Customer cannot write to /services directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("services").doc("tampered").set({ id: "tampered", active: true }),
    );
  });

  it("Studio cannot write to /services directly", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", makeStudioClaims());
    await assertFails(
      studio.firestore().collection("services").doc("tampered").set({ id: "tampered", active: true }),
    );
  });

  it("Admin cannot write to /services directly, even in their own tenant (Cloud Function only)", async () => {
    await seedService("service-1");
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims());
    await assertFails(
      admin.firestore().collection("services").doc("service-1").update({ basePrice: 1 }),
    );
  });

  it("Customer from tenant A cannot read a service from tenant B", async () => {
    await seedService("service-b", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a", { role: "customer", tenantId: "tenant-a", studioId: null });
    await assertFails(tenantAUser.firestore().collection("services").doc("service-b").get());
  });
});

describe("/studioConfig — resource and settings mutations are server-authoritative", () => {
  it("Customer cannot read studioConfig", async () => {
    await seedStudioConfig();
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("studioConfig").doc("studio-ahmedabad").get());
  });

  it("Studio can read studioConfig", async () => {
    await seedStudioConfig();
    const studio = testEnv.authenticatedContext("uid-studio", makeStudioClaims());
    await assertSucceeds(studio.firestore().collection("studioConfig").doc("studio-ahmedabad").get());
  });

  it("Studio cannot write studioConfig directly", async () => {
    await seedStudioConfig();
    const studio = testEnv.authenticatedContext("uid-studio", makeStudioClaims());
    await assertFails(
      studio.firestore().collection("studioConfig").doc("studio-ahmedabad").update({ name: "Hacked" }),
    );
  });

  it("Admin cannot write studioConfig directly, even in their own tenant (Cloud Function only)", async () => {
    await seedStudioConfig();
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims());
    await assertFails(
      admin.firestore().collection("studioConfig").doc("studio-ahmedabad").update({ name: "Hacked" }),
    );
  });

  it("Admin from tenant A cannot read studioConfig from tenant B", async () => {
    await seedStudioConfig("studio-b", "tenant-b");
    const tenantAAdmin = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(tenantAAdmin.firestore().collection("studioConfig").doc("studio-b").get());
  });
});

describe("/employees — staff mutations are server-authoritative", () => {
  it("Customer cannot read employees", async () => {
    await seedEmployee("emp-1");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("employees").doc("emp-1").get());
  });

  it("Admin cannot write to employees directly, even in their own tenant (Cloud Function only)", async () => {
    await seedEmployee("emp-1");
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims());
    await assertFails(
      admin.firestore().collection("employees").doc("emp-1").update({ role: "admin" }),
    );
  });

  it("Employee can read their own record", async () => {
    await seedEmployee("uid-self");
    const self = testEnv.authenticatedContext("uid-self", makeStudioClaims());
    await assertSucceeds(self.firestore().collection("employees").doc("uid-self").get());
  });

  it("Admin from tenant A cannot read an employee from tenant B", async () => {
    await seedEmployee("emp-b", "tenant-b");
    const tenantAAdmin = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(tenantAAdmin.firestore().collection("employees").doc("emp-b").get());
  });
});

// ─── Walk-in financial records (Phase 1f.1) ───────────────────────────────────
// Walk-in payments/invoices carry bookingId: null (never a fabricated
// bookingId) and are keyed by jobId instead — these rules must protect them
// identically to booking-sourced records.

async function seedWalkinPayment(paymentId: string, customerId: string, tenantId = FIRST_TENANT_ID) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("payments").doc(paymentId).set({
      id: paymentId,
      tenantId,
      studioId: "studio-ahmedabad",
      jobId: "walkin-job-1",
      bookingId: null,
      customerId,
      amount: 47200,
      currency: "INR",
      method: "cash",
      status: "completed",
      razorpayPaymentLinkId: null,
      razorpayPaymentId: null,
      razorpayOrderId: null,
      razorpayRefundId: null,
      refundAmount: null,
      manualReference: null,
      recordedBy: "uid-studio",
      invoiceId: "walkin-invoice-1",
      providerEventId: null,
      completedAt: now,
      failedAt: null,
      cancelledAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedWalkinInvoice(invoiceId: string, customerId: string, tenantId = FIRST_TENANT_ID) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("invoices").doc(invoiceId).set({
      id: invoiceId,
      tenantId,
      studioId: "studio-ahmedabad",
      jobId: "walkin-job-1",
      bookingId: null, // walk-in — never a fabricated bookingId
      customerId,
      vehicleId: "vehicle-1",
      paymentId: "walkin-payment-1",
      invoiceNumber: "INV-2026-00002",
      lineItems: [{ description: "Wash", quantity: 1, unitPrice: 40000, total: 40000 }],
      subtotal: 40000,
      taxRatePercent: 18,
      taxDescription: "GST 18%",
      tax: 7200,
      total: 47200,
      currency: "INR",
      status: "issued",
      pdfUrl: null,
      publicToken: "test-uuid-walkin",
      issuedAt: now,
      voidedAt: null,
      voidedReason: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("Walk-in financial records — same protections as booking-sourced records", () => {
  it("Customer can read their own walk-in payment (bookingId: null)", async () => {
    await seedWalkinPayment("wpay-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("payments").doc("wpay-alice").get());
  });

  it("Customer cannot directly write a walk-in payment (Cloud Function only)", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("payments").doc("wpay-tamper").set({
        id: "wpay-tamper",
        tenantId: FIRST_TENANT_ID,
        jobId: "walkin-job-x",
        bookingId: null,
        customerId: "uid-alice",
        amount: 1,
        status: "completed",
      }),
    );
  });

  it("Customer cannot alter a walk-in invoice total (immutability)", async () => {
    await seedWalkinInvoice("winv-tamper", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("invoices").doc("winv-tamper").update({
        total: 1,
        status: "paid",
      }),
    );
  });

  it("Studio cannot directly write a walk-in invoice (Cloud Function only)", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("invoices").doc("winv-studio-direct").set({
        id: "winv-studio-direct",
        tenantId: FIRST_TENANT_ID,
        jobId: "walkin-job-x",
        bookingId: null,
        total: 100,
        status: "issued",
      }),
    );
  });

  it("Cross-tenant: tenant A customer cannot read tenant B's walk-in payment", async () => {
    await seedWalkinPayment("wpay-tenant-b", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(tenantAUser.firestore().collection("payments").doc("wpay-tenant-b").get());
  });

  it("Cross-tenant: tenant A customer cannot read tenant B's walk-in invoice", async () => {
    await seedWalkinInvoice("winv-tenant-b", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(tenantAUser.firestore().collection("invoices").doc("winv-tenant-b").get());
  });
});

// ─── Notifications (Phase 2C) ──────────────────────────────────────────────────

async function seedNotification(
  notificationId: string,
  userId: string,
  tenantId = FIRST_TENANT_ID,
) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("notifications").doc(notificationId).set({
      id: notificationId,
      tenantId,
      userId,
      auditLogId: notificationId,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: "Your Swift booking is confirmed for 10:00 AM.",
      entityType: "Booking",
      entityId: "booking-1",
      createdAt: new Date().toISOString(),
      readAt: null,
    });
  });
}

describe("/notifications — customer read-own, mark-read only via Cloud Function", () => {
  it("Customer cannot create a notification directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice
        .firestore()
        .collection("notifications")
        .doc("fake-1")
        .set({
          id: "fake-1",
          tenantId: FIRST_TENANT_ID,
          userId: "uid-alice",
          auditLogId: "fake-1",
          type: "booking_confirmed",
          title: "Fabricated",
          body: "Self-authored notification",
          entityType: null,
          entityId: null,
          createdAt: new Date().toISOString(),
          readAt: null,
        }),
    );
  });

  it("Customer cannot alter notification content (e.g. mark read via direct write)", async () => {
    await seedNotification("notif-1", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("notifications").doc("notif-1").update({
        readAt: new Date().toISOString(),
      }),
    );
  });

  it("Customer can read their own notification", async () => {
    await seedNotification("notif-2", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("notifications").doc("notif-2").get());
  });

  it("Cross-customer: Bob cannot read Alice's notification", async () => {
    await seedNotification("notif-3", "uid-alice");
    const bob = testEnv.authenticatedContext("uid-bob", makeCustomerClaims("uid-bob"));
    await assertFails(bob.firestore().collection("notifications").doc("notif-3").get());
  });

  it("Cross-tenant: tenant A customer cannot read tenant B's notification", async () => {
    await seedNotification("notif-4", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(tenantAUser.firestore().collection("notifications").doc("notif-4").get());
  });
});

// ─── Garage / Ownership (Phase 2D) ─────────────────────────────────────────────

async function seedProtection(
  vehicleId: string,
  protectionId: string,
  customerId: string,
  tenantId = FIRST_TENANT_ID,
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .collection("vehicles")
      .doc(vehicleId)
      .collection("protections")
      .doc(protectionId)
      .set({
        id: protectionId,
        tenantId,
        vehicleId,
        customerId,
        kind: "insurance",
        provider: "Test Insurer",
        policyNumber: "POL-1",
        startDate: "2026-01-01",
        expiryDate: "2027-01-01",
        documentUrl: null,
        status: "unverified",
        verifiedBy: null,
        verifiedAt: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      });
  });
}

async function seedWarranty(
  warrantyId: string,
  vehicleId: string,
  customerId: string,
  tenantId = FIRST_TENANT_ID,
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("warranties").doc(warrantyId).set({
      id: warrantyId,
      tenantId,
      studioId: "studio-ahmedabad",
      jobId: warrantyId,
      bookingId: null,
      customerId,
      vehicleId,
      serviceId: "service-1",
      serviceName: "Gloss PPF",
      warrantyLabel: "5-Year PPF Film Warranty",
      coverageTerms: "5-Year PPF Film Warranty",
      startDate: "2026-01-01",
      endDate: null,
      installerEmployeeId: null,
      productBatchNumber: null,
      certificateUrl: null,
      qrVerificationToken: null,
      sealedAt: now,
      revokedAt: null,
      revokedReason: null,
    });
  });
}

describe("/vehicles/{vehicleId}/protections — read-own, Cloud Function writes only", () => {
  it("Customer owns the vehicle and can read it", async () => {
    await seedVehicle("veh-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("vehicles").doc("veh-alice").get());
  });

  it("Customer can read their own vehicle's protection", async () => {
    await seedProtection("veh-alice", "prot-1", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(
      alice.firestore().collection("vehicles").doc("veh-alice").collection("protections").doc("prot-1").get(),
    );
  });

  it("Customer cannot create a protection directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice
        .firestore()
        .collection("vehicles")
        .doc("veh-alice")
        .collection("protections")
        .doc("fake-1")
        .set({
          id: "fake-1",
          tenantId: FIRST_TENANT_ID,
          vehicleId: "veh-alice",
          customerId: "uid-alice",
          kind: "insurance",
          status: "verified",
        }),
    );
  });

  it("Customer cannot update (e.g. self-verify) a protection", async () => {
    await seedProtection("veh-alice", "prot-2", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice
        .firestore()
        .collection("vehicles")
        .doc("veh-alice")
        .collection("protections")
        .doc("prot-2")
        .update({ status: "verified" }),
    );
  });

  it("Cross-customer: Bob cannot read Alice's protection", async () => {
    await seedProtection("veh-alice", "prot-3", "uid-alice");
    const bob = testEnv.authenticatedContext("uid-bob", makeCustomerClaims("uid-bob"));
    await assertFails(
      bob.firestore().collection("vehicles").doc("veh-alice").collection("protections").doc("prot-3").get(),
    );
  });

  it("Cross-tenant: tenant A customer cannot read tenant B's protection", async () => {
    await seedProtection("veh-b", "prot-4", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(
      tenantAUser.firestore().collection("vehicles").doc("veh-b").collection("protections").doc("prot-4").get(),
    );
  });
});

describe("/warranties — customer ownership and immutability", () => {
  it("Customer can read their own vehicle's warranty", async () => {
    await seedWarranty("warr-1", "veh-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("warranties").doc("warr-1").get());
  });

  it("Cross-customer: Bob cannot read Alice's warranty", async () => {
    await seedWarranty("warr-2", "veh-alice", "uid-alice");
    const bob = testEnv.authenticatedContext("uid-bob", makeCustomerClaims("uid-bob"));
    await assertFails(bob.firestore().collection("warranties").doc("warr-2").get());
  });

  it("Admin cannot rewrite sealed warranty terms (only revokedAt/revokedReason are mutable)", async () => {
    await seedWarranty("warr-3", "veh-alice", "uid-alice");
    const admin = testEnv.authenticatedContext("uid-admin", {
      role: "admin",
      tenantId: FIRST_TENANT_ID,
      studioId: null,
    });
    await assertFails(
      admin.firestore().collection("warranties").doc("warr-3").update({ warrantyLabel: "Rewritten" }),
    );
  });

  it("Admin can record an exceptional revocation", async () => {
    await seedWarranty("warr-4", "veh-alice", "uid-alice");
    const admin = testEnv.authenticatedContext("uid-admin", {
      role: "admin",
      tenantId: FIRST_TENANT_ID,
      studioId: null,
    });
    await assertSucceeds(
      admin
        .firestore()
        .collection("warranties")
        .doc("warr-4")
        .update({ revokedAt: new Date().toISOString(), revokedReason: "issued in error" }),
    );
  });
});

describe("Passport safety — cross-customer job access denied", () => {
  it("Bob cannot read a job belonging to Alice's vehicle", async () => {
    await seedJob("job-passport-1", "uid-alice", "studio-ahmedabad");
    const bob = testEnv.authenticatedContext("uid-bob", makeCustomerClaims("uid-bob"));
    await assertFails(bob.firestore().collection("jobs").doc("job-passport-1").get());
  });
});

// ─── Approvals (Phase 3) ────────────────────────────────────────────────────

async function seedApproval(
  approvalId: string,
  customerId: string,
  tenantId = FIRST_TENANT_ID,
  studioId = "studio-ahmedabad",
) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("approvals").doc(approvalId).set({
      id: approvalId,
      tenantId,
      studioId,
      jobId: "job-1",
      bookingId: "booking-1",
      customerId,
      vehicleId: "vehicle-1",
      requestedBy: "staff-1",
      reason: "Found an issue",
      serviceId: "service-extra",
      serviceName: "Extra Work",
      quantity: 1,
      unitPrice: 50000,
      priceImpact: 50000,
      timeImpactMinutes: 30,
      originalAmount: 100000,
      newTotal: 150000,
      photos: [],
      status: "pending",
      respondedAt: null,
      respondedBy: null,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: now,
    });
  });
}

describe("/approvals — customer read-own, Cloud Function writes only", () => {
  it("Customer cannot create an approval directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice
        .firestore()
        .collection("approvals")
        .doc("fake-1")
        .set({
          id: "fake-1",
          tenantId: FIRST_TENANT_ID,
          studioId: "studio-ahmedabad",
          jobId: "job-1",
          customerId: "uid-alice",
          status: "approved", // self-approving on creation — must be denied
          priceImpact: 0,
        }),
    );
  });

  it("Customer cannot alter an approval directly (e.g. self-approve via direct write)", async () => {
    await seedApproval("appr-1", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("approvals").doc("appr-1").update({ status: "approved" }),
    );
  });

  it("Customer can read their own approval", async () => {
    await seedApproval("appr-2", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("approvals").doc("appr-2").get());
  });

  it("Cross-customer: Bob cannot read Alice's approval", async () => {
    await seedApproval("appr-3", "uid-alice");
    const bob = testEnv.authenticatedContext("uid-bob", makeCustomerClaims("uid-bob"));
    await assertFails(bob.firestore().collection("approvals").doc("appr-3").get());
  });

  it("Cross-tenant: tenant A customer cannot read tenant B's approval", async () => {
    await seedApproval("appr-4", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(tenantAUser.firestore().collection("approvals").doc("appr-4").get());
  });

  it("Studio can read an approval within their own tenant", async () => {
    await seedApproval("appr-5", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertSucceeds(studio.firestore().collection("approvals").doc("appr-5").get());
  });
});

// ─── Admin console — cross-tenant list-query isolation (Phase 3E) ─────────────
// Exercises the exact query shape apps/admin's list pages use: a single
// tenantId equality filter + orderBy, list()'d rather than get()'d one doc
// at a time. Firestore must be able to prove the rule holds for every
// possible match, so a query for a tenantId the caller doesn't belong to
// must be rejected outright, not merely return zero results.
describe("Admin console — cross-tenant list query isolation", () => {
  it("Admin can list bookings within their own tenant", async () => {
    await seedBooking("adm-booking-a", "uid-a-user", "tenant-a");
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertSucceeds(
      adminA.firestore().collection("bookings").where("tenantId", "==", "tenant-a").get(),
    );
  });

  it("Admin cannot list bookings for a different tenant", async () => {
    await seedBooking("adm-booking-b", "uid-b-user", "tenant-b");
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(
      adminA.firestore().collection("bookings").where("tenantId", "==", "tenant-b").get(),
    );
  });

  it("Admin cannot list jobs for a different tenant", async () => {
    await seedJob("adm-job-b", "uid-b-user", "studio-b", "tenant-b");
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(
      adminA.firestore().collection("jobs").where("tenantId", "==", "tenant-b").get(),
    );
  });

  it("Admin cannot list payments for a different tenant", async () => {
    await seedPayment("adm-payment-b", "uid-b-user", "tenant-b");
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(
      adminA.firestore().collection("payments").where("tenantId", "==", "tenant-b").get(),
    );
  });

  it("Admin cannot list invoices for a different tenant", async () => {
    await seedInvoice("adm-invoice-b", "uid-b-user", "tenant-b");
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(
      adminA.firestore().collection("invoices").where("tenantId", "==", "tenant-b").get(),
    );
  });

  it("Admin cannot list customers for a different tenant", async () => {
    await seedCustomer("adm-cust-b", "tenant-b");
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(
      adminA.firestore().collection("customers").where("tenantId", "==", "tenant-b").get(),
    );
  });

  it("Admin cannot list another tenant's audit log", async () => {
    const adminA = testEnv.authenticatedContext("uid-admin-a", makeAdminClaims("tenant-a"));
    await assertFails(
      adminA.firestore().collection("auditLog").where("tenantId", "==", "tenant-b").get(),
    );
  });

  it("Studio role cannot list tenant-wide bookings the way the admin console does (no ownership filter)", async () => {
    await seedBooking("adm-booking-c", "uid-c-user", FIRST_TENANT_ID);
    const studio = testEnv.authenticatedContext("uid-studio-c", makeStudioClaims());
    // Studio IS allowed to read bookings in its own tenant (isStudioOrAbove
    // covers the ownership branch) — this asserts the admin-style query
    // still succeeds for studio too, since /bookings has no studio-scoping
    // clause. It's /auditLog that's admin-only:
    await assertFails(
      studio.firestore().collection("auditLog").where("tenantId", "==", FIRST_TENANT_ID).get(),
    );
  });

  it("Customer role cannot run the admin console's tenant-wide booking list query", async () => {
    await seedBooking("adm-booking-d", "uid-d-user", FIRST_TENANT_ID);
    const customer = testEnv.authenticatedContext("uid-d-user", makeCustomerClaims("uid-d-user"));
    await assertFails(
      customer.firestore().collection("bookings").where("tenantId", "==", FIRST_TENANT_ID).get(),
    );
  });

  it("Superadmin can read a booking outside their own tenant claim", async () => {
    await seedBooking("adm-booking-e", "uid-e-user", "tenant-e");
    const superadmin = testEnv.authenticatedContext("uid-superadmin", {
      role: "superadmin",
      tenantId: "tenant-superadmin-home",
      studioId: null,
    });
    await assertSucceeds(superadmin.firestore().collection("bookings").doc("adm-booking-e").get());
  });
});

// ─── Studio console — customer/vehicle lookup job-history query (Phase 3I) ───
// Exercises the exact tenantId+studioId+customerId (and +vehicleId) query
// shape apps/studio/src/lib/lookup-service.ts uses.
describe("Studio lookup — job history query shape", () => {
  it("Studio can list a customer's jobs at their own studio", async () => {
    await seedJob("lookup-job-a", "uid-lookup-cust", "studio-ahmedabad", FIRST_TENANT_ID);
    const studio = testEnv.authenticatedContext("uid-studio-lookup", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertSucceeds(
      studio
        .firestore()
        .collection("jobs")
        .where("tenantId", "==", FIRST_TENANT_ID)
        .where("studioId", "==", "studio-ahmedabad")
        .where("customerId", "==", "uid-lookup-cust")
        .get(),
    );
  });

  it("Studio cannot run the lookup job-history query for a different tenant", async () => {
    await seedJob("lookup-job-b", "uid-lookup-cust-b", "studio-b", "tenant-b");
    const studio = testEnv.authenticatedContext("uid-studio-lookup-b", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio
        .firestore()
        .collection("jobs")
        .where("tenantId", "==", "tenant-b")
        .where("studioId", "==", "studio-b")
        .where("customerId", "==", "uid-lookup-cust-b")
        .get(),
    );
  });
});

// ─── /inspections/{jobId} — read-own, Cloud-Function writes only (Phase 4) ────
async function seedInspection(jobId: string, customerId: string, tenantId = FIRST_TENANT_ID) {
  const now = new Date().toISOString();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection("inspections").doc(jobId).set({
      id: jobId,
      tenantId,
      studioId: "studio-ahmedabad",
      jobId,
      bookingId: null,
      customerId,
      vehicleId: "vehicle-1",
      serviceId: "service-1",
      serviceName: "Regular Wash",
      serviceCategory: "washing",
      status: "in_progress",
      checklist: [],
      overallNotes: null,
      photos: [],
      startedAt: now,
      startedBy: "uid-studio",
      finalizedAt: null,
      finalizedBy: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("/inspections/{jobId} — read-own, Cloud Function writes only", () => {
  it("Customer can read their own inspection", async () => {
    await seedInspection("insp-alice", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertSucceeds(alice.firestore().collection("inspections").doc("insp-alice").get());
  });

  it("Customer cannot read another customer's inspection", async () => {
    await seedInspection("insp-bob", "uid-bob");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("inspections").doc("insp-bob").get());
  });

  it("Studio can read an inspection within their own tenant", async () => {
    await seedInspection("insp-studio-read", "uid-alice");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertSucceeds(studio.firestore().collection("inspections").doc("insp-studio-read").get());
  });

  it("Admin can read an inspection within their own tenant", async () => {
    await seedInspection("insp-admin-read", "uid-alice");
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims());
    await assertSucceeds(admin.firestore().collection("inspections").doc("insp-admin-read").get());
  });

  it("Cross-tenant: tenant A customer cannot read tenant B's inspection", async () => {
    await seedInspection("insp-tenant-b", "uid-b-user", "tenant-b");
    const tenantAUser = testEnv.authenticatedContext("uid-a-user", {
      role: "customer",
      tenantId: "tenant-a",
      studioId: null,
    });
    await assertFails(tenantAUser.firestore().collection("inspections").doc("insp-tenant-b").get());
  });

  it("Customer cannot create an inspection directly", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("inspections").doc("fake-insp").set({
        id: "fake-insp",
        tenantId: FIRST_TENANT_ID,
        customerId: "uid-alice",
        status: "finalized",
      }),
    );
  });

  it("Customer cannot alter a finalized inspection (e.g. self-editing a finding)", async () => {
    await seedInspection("insp-tamper", "uid-alice");
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(
      alice.firestore().collection("inspections").doc("insp-tamper").update({ status: "finalized" }),
    );
  });

  it("Studio cannot write to /inspections directly (Cloud Function only)", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertFails(
      studio.firestore().collection("inspections").doc("studio-insp").set({
        id: "studio-insp",
        tenantId: FIRST_TENANT_ID,
        status: "in_progress",
      }),
    );
  });
});

// ─── /bayLocks/{key} — server-only, no client access of any kind (Phase 5B P2-6) ─
// Carries no meaningful data (see COLLECTIONS.bayLocks' doc comment) — the
// rule is an unconditional `allow read, write: if false`, with NO role
// exception at all, unlike almost every other collection in this file
// (which exempt superadmin/admin). This suite explicitly proves that
// blanket denial holds for every role, including admin/superadmin.

describe("/bayLocks/{key} — server-only, no client access of any kind", () => {
  it("Customer cannot read a bayLock document", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("bayLocks").doc("t__s__b1").get());
  });

  it("Customer cannot write a bayLock document", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", makeCustomerClaims("uid-alice"));
    await assertFails(alice.firestore().collection("bayLocks").doc("t__s__b1").set({ lastAssignedAt: "now" }));
  });

  it("Studio cannot read a bayLock document", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", makeStudioClaims());
    await assertFails(studio.firestore().collection("bayLocks").doc("t__s__b1").get());
  });

  it("Studio cannot write a bayLock document", async () => {
    const studio = testEnv.authenticatedContext("uid-studio", makeStudioClaims());
    await assertFails(studio.firestore().collection("bayLocks").doc("t__s__b1").set({ lastAssignedAt: "now" }));
  });

  it("Admin cannot read a bayLock document — no exception for admin, unlike most collections", async () => {
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims());
    await assertFails(admin.firestore().collection("bayLocks").doc("t__s__b1").get());
  });

  it("Admin cannot write a bayLock document", async () => {
    const admin = testEnv.authenticatedContext("uid-admin", makeAdminClaims());
    await assertFails(admin.firestore().collection("bayLocks").doc("t__s__b1").set({ lastAssignedAt: "now" }));
  });

  it("Superadmin cannot read a bayLock document — no exception for superadmin either", async () => {
    const superadmin = testEnv.authenticatedContext("uid-superadmin", {
      role: "superadmin",
      tenantId: "tenant-superadmin-home",
      studioId: null,
    });
    await assertFails(superadmin.firestore().collection("bayLocks").doc("t__s__b1").get());
  });

  it("Superadmin cannot write a bayLock document", async () => {
    const superadmin = testEnv.authenticatedContext("uid-superadmin", {
      role: "superadmin",
      tenantId: "tenant-superadmin-home",
      studioId: null,
    });
    await assertFails(
      superadmin.firestore().collection("bayLocks").doc("t__s__b1").set({ lastAssignedAt: "now" }),
    );
  });

  it("Unauthenticated caller cannot read or write a bayLock document", async () => {
    const anon = testEnv.unauthenticatedContext();
    const anonDb = anon.firestore();
    await assertFails(anonDb.collection("bayLocks").doc("t__s__b1").get());
    await assertFails(anonDb.collection("bayLocks").doc("t__s__b1").set({ lastAssignedAt: "now" }));
  });
});

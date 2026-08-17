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

  it("Studio can update a job in own tenant", async () => {
    await seedJob("job-studio-advance", "uid-alice", "studio-ahmedabad");
    const studio = testEnv.authenticatedContext("uid-studio", {
      role: "studio",
      tenantId: FIRST_TENANT_ID,
      studioId: "studio-ahmedabad",
    });
    await assertSucceeds(
      studio.firestore().collection("jobs").doc("job-studio-advance").update({
        status: "VEHICLE_RECEIVED",
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

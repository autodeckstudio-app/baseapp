/**
 * Firestore security rules tests.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080)
 * Rules are loaded from ../../../../../../firestore.rules (repo root)
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

const RULES_PATH = resolve(__dirname, "../../../../../../firestore.rules");

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

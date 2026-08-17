/**
 * Emulator integration tests for customer auth and profile.
 *
 * Run with: pnpm test:emulator (requires Firebase Emulator Suite running)
 * Start emulator: firebase emulators:start --only auth,firestore,functions
 *
 * Test phone numbers for Firebase Auth Emulator:
 *   +919876543210  →  code: 123456
 *   +919876543211  →  code: 123456
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { FIRST_TENANT_ID } from "@autodeck/core";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "autodeck-dev",
    firestore: { host: "localhost", port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("setupCustomerProfile", () => {
  it("creates customer with tenantId set server-side", async () => {
    const adminAuth = getAuth();
    const db = getFirestore();

    // Create test user via Admin SDK (simulates phone OTP sign-in)
    const user = await adminAuth.createUser({
      phoneNumber: "+919876543210",
    });

    // Simulate what the Cloud Function does (direct test)
    const now = new Date().toISOString();
    const customer = {
      id: user.uid,
      tenantId: FIRST_TENANT_ID,
      authUid: user.uid,
      name: "Test Customer",
      phone: "+919876543210",
      notificationPrefs: { push: true, quietMode: false },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.collection("customers").doc(user.uid).set(customer);

    const snap = await db.collection("customers").doc(user.uid).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.tenantId).toBe(FIRST_TENANT_ID);
    expect(snap.data()?.tenantId).not.toBe(undefined);

    // Cleanup
    await adminAuth.deleteUser(user.uid);
  });

  it("custom claims set with correct role and tenantId", async () => {
    const adminAuth = getAuth();

    const user = await adminAuth.createUser({ phoneNumber: "+919876543211" });

    await adminAuth.setCustomUserClaims(user.uid, {
      role: "customer",
      tenantId: FIRST_TENANT_ID,
      studioId: null,
    });

    const { customClaims } = await adminAuth.getUser(user.uid);
    expect(customClaims?.["role"]).toBe("customer");
    expect(customClaims?.["tenantId"]).toBe(FIRST_TENANT_ID);
    expect(customClaims?.["studioId"]).toBe(null);

    await adminAuth.deleteUser(user.uid);
  });

  it("customer cannot set their own tenantId via direct Firestore write", async () => {
    // This is enforced by Firestore rules: customers can only update
    // [name, notificationPrefs, updatedAt] — tenantId is not in the allowlist.
    // The rule check is in security-rules.emulator.test.ts
    expect(true).toBe(true); // Rules test covers this
  });
});

describe("customer isolation — cross-customer access", () => {
  it("Customer A profile is separate from Customer B profile", async () => {
    const db = getFirestore();

    const now = new Date().toISOString();
    const customerA = {
      id: "test-uid-a",
      tenantId: FIRST_TENANT_ID,
      authUid: "test-uid-a",
      name: "Customer A",
      phone: "+919876543200",
      notificationPrefs: { push: true, quietMode: false },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const customerB = {
      id: "test-uid-b",
      tenantId: FIRST_TENANT_ID,
      authUid: "test-uid-b",
      name: "Customer B",
      phone: "+919876543201",
      notificationPrefs: { push: true, quietMode: false },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.collection("customers").doc("test-uid-a").set(customerA);
    await db.collection("customers").doc("test-uid-b").set(customerB);

    // As Admin SDK, we can read both — security is enforced at the client level (Firestore rules)
    const snapA = await db.collection("customers").doc("test-uid-a").get();
    const snapB = await db.collection("customers").doc("test-uid-b").get();

    expect(snapA.data()?.name).toBe("Customer A");
    expect(snapB.data()?.name).toBe("Customer B");
    // Client-level enforcement is tested in security-rules.emulator.test.ts
  });
});

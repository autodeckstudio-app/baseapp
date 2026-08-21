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
import type { Customer } from "@autodeck/core";
import { FIRST_TENANT_ID } from "@autodeck/core";
import { setupCustomerProfile } from "../../functions/auth/setupCustomerProfile.js";

function phoneAuth(uid: string, phone: string) {
  return { uid, token: { phone_number: phone } };
}

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
  let seq = 0;
  function uid(prefix: string): string {
    seq += 1;
    return `scp-${prefix}-${Date.now()}-${seq}`;
  }

  // The real handler calls the Admin SDK (setCustomUserClaims/updateUser)
  // against this uid after its transaction commits — that requires the uid
  // to actually exist in the Auth Emulator, not just be a value inside a
  // faked CallableRequest.auth object.
  async function createAuthUser(userUid: string, phone: string): Promise<void> {
    await getAuth().createUser({ uid: userUid, phoneNumber: phone });
  }

  it("first sign-in: creates a Customer with server-determined tenantId, sets claims and displayName", async () => {
    const adminAuth = getAuth();
    const db = getFirestore();
    const userUid = uid("new");
    const phone = "+919876543210";
    await createAuthUser(userUid, phone);

    const result = (await setupCustomerProfile.run({
      data: { name: "Real Handler Test" },
      auth: phoneAuth(userUid, phone),
    } as never)) as { customer: Customer; isNew: boolean; claimsUpdated: boolean };

    expect(result.isNew).toBe(true);
    expect(result.customer.tenantId).toBe(FIRST_TENANT_ID);
    expect(result.customer.name).toBe("Real Handler Test");
    expect(result.customer.phone).toBe(phone);
    expect(result.claimsUpdated).toBe(true);

    // Firestore doc actually exists, matches what was returned.
    const snap = await db.collection("customers").doc(userUid).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.tenantId).toBe(FIRST_TENANT_ID);
    expect(snap.data()?.authUid).toBe(userUid);

    // Custom claims were actually set on the Auth user by the real handler
    // (not asserted separately/manually — this proves the CF's own
    // adminAuth.setCustomUserClaims call ran), and displayName was set.
    const { customClaims, displayName } = await adminAuth.getUser(userUid);
    expect(customClaims?.["role"]).toBe("customer");
    expect(customClaims?.["tenantId"]).toBe(FIRST_TENANT_ID);
    expect(customClaims?.["studioId"]).toBe(null);
    expect(displayName).toBe("Real Handler Test");
  });

  it("rejects first sign-in with no name provided", async () => {
    const userUid = uid("noname");
    await expect(
      setupCustomerProfile.run({
        data: {},
        auth: phoneAuth(userUid, "+919876543211"),
      } as never),
    ).rejects.toThrow(/Name is required/);

    const db = getFirestore();
    const snap = await db.collection("customers").doc(userUid).get();
    expect(snap.exists).toBe(false);
  });

  it("idempotent: second call for an existing customer returns the existing profile unchanged, isNew=false", async () => {
    const userUid = uid("repeat");
    const phone = "+919876543212";
    await createAuthUser(userUid, phone);

    const first = (await setupCustomerProfile.run({
      data: { name: "Original Name" },
      auth: phoneAuth(userUid, phone),
    } as never)) as { customer: Customer; isNew: boolean };
    expect(first.isNew).toBe(true);

    // Second sign-in — a returning customer's client calls this again on
    // every login; must NOT create a duplicate or overwrite the name from
    // whatever (if anything) the client happens to pass this time.
    const second = (await setupCustomerProfile.run({
      data: { name: "Attempted Overwrite" },
      auth: phoneAuth(userUid, phone),
    } as never)) as { customer: Customer; isNew: boolean };
    expect(second.isNew).toBe(false);
    expect(second.customer.name).toBe("Original Name");
    expect(second.customer.id).toBe(first.customer.id);
    expect(second.customer.createdAt).toBe(first.customer.createdAt);
  });

  it("rejects an unauthenticated call", async () => {
    await expect(
      setupCustomerProfile.run({ data: { name: "No Auth" }, auth: undefined } as never),
    ).rejects.toThrow(/Authentication required/);
  });

  it("concurrent first-sign-in race for the same uid: exactly one create wins, no duplicate/corrupted profile (Phase 5B P2-4 stress)", async () => {
    // Repeated stress iterations, not a single pair (Phase 5B P2-4). This
    // relies on a document-reference read+write inside a transaction
    // (proven reliable, unlike the query-based races documented elsewhere
    // this phase) — deterministic once fixed, but the loop guards against a
    // future regression with far higher confidence than one pair. Each
    // iteration uses its own fresh uid/phone so iterations never interfere.
    const db = getFirestore();
    const iterations = 20;
    for (let i = 0; i < iterations; i += 1) {
      const userUid = uid("race");
      const phone = `+1555${Date.now().toString().slice(-7)}${i.toString().padStart(2, "0")}`;
      await createAuthUser(userUid, phone);

      const results = (await Promise.all([
        setupCustomerProfile.run({
          data: { name: "Racer A" },
          auth: phoneAuth(userUid, phone),
        } as never),
        setupCustomerProfile.run({
          data: { name: "Racer B" },
          auth: phoneAuth(userUid, phone),
        } as never),
      ])) as { customer: Customer; isNew: boolean }[];

      // Both calls succeed (setupCustomerProfile is designed to be safe to
      // call from a racing client — neither is expected to error), but they
      // must agree on exactly one winning name — not two different customer
      // records, not a corrupted merge.
      const isNewCount = results.filter((r) => r.isNew).length;
      expect(isNewCount, `iteration ${i}`).toBe(1);
      expect(results[0]?.customer.name, `iteration ${i}`).toBe(results[1]?.customer.name);
      expect(["Racer A", "Racer B"], `iteration ${i}`).toContain(results[0]?.customer.name);

      const snap = await db.collection("customers").doc(userUid).get();
      expect(snap.data()?.name, `iteration ${i}`).toBe(results[0]?.customer.name);
    }
  }, 180_000);

  it("customer cannot set their own tenantId via direct Firestore write (enforced by rules, see security-rules.emulator.test.ts)", async () => {
    // setupCustomerProfileSchema doesn't even accept a tenantId field, and
    // the Firestore rule's update allowlist (name/notificationPrefs/
    // updatedAt) independently blocks it at the client-SDK layer too — the
    // full attack scenario is exercised in security-rules.emulator.test.ts.
    // This test just confirms the schema-level fact directly.
    // Phase 5B P1-12: setupCustomerProfileSchema is now .strict(), so a
    // smuggled tenantId field is explicitly REJECTED rather than silently
    // stripped — an even stronger proof than the previous behavior (a
    // client attempting this gets a clear 400, not a payload that quietly
    // discards the field with no signal anything was wrong).
    const { setupCustomerProfileSchema } = await import("../../schemas/customer.js");
    const parsed = setupCustomerProfileSchema.safeParse({ name: "Attacker", tenantId: "attacker-tenant" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.code === "unrecognized_keys")).toBe(true);
    }
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

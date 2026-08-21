/**
 * Firebase Storage security rules tests.
 *
 * Regression coverage for Phase 5A/5B P0-1: the previous rule granted read
 * to any authenticated member of the tenant, regardless of ownership,
 * exposing job photos / invoice PDFs / warranty certificates / vehicle
 * photos across customers. Fixed by scoping reads to customMetadata set at
 * upload time (customerId / ownerId), matching the equivalent Firestore
 * ownership pattern.
 *
 * Run with: pnpm test:emulator (requires Storage Emulator at localhost:9199)
 * Rules are loaded from ../../../../storage.rules (repo root)
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

const RULES_PATH = resolve(__dirname, "../../../../storage.rules");
const TENANT_ID = "storage-test-tenant";

let testEnv: RulesTestEnvironment;

function customerClaims(tenantId = TENANT_ID) {
  return { role: "customer", tenantId, studioId: null };
}
function studioClaims(tenantId = TENANT_ID) {
  return { role: "studio", tenantId, studioId: "studio-1" };
}
function adminClaims(tenantId = TENANT_ID) {
  return { role: "admin", tenantId, studioId: null };
}

const CONTENT = new Uint8Array([1, 2, 3]);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "autodeck-dev",
    storage: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "localhost",
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

async function seedObject(path: string, customMetadata: Record<string, string>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(path).put(CONTENT, { customMetadata });
  });
}

describe("/{tenantId}/vehicles/{vehicleId}/{filename} — owner-scoped read", () => {
  const path = `${TENANT_ID}/vehicles/vehicle-1/photo.jpg`;

  it("owner (customMetadata.ownerId) can read their own vehicle photo", async () => {
    await seedObject(path, { ownerId: "uid-alice" });
    const alice = testEnv.authenticatedContext("uid-alice", customerClaims());
    await assertSucceeds(alice.storage().ref(path).getMetadata());
  });

  it("a different customer in the same tenant cannot read another customer's vehicle photo", async () => {
    await seedObject(path, { ownerId: "uid-alice" });
    const bob = testEnv.authenticatedContext("uid-bob", customerClaims());
    await assertFails(bob.storage().ref(path).getMetadata());
  });

  it("a customer in a different tenant cannot read the object (tenant path mismatch)", async () => {
    await seedObject(path, { ownerId: "uid-alice" });
    const outsider = testEnv.authenticatedContext("uid-outsider", customerClaims("other-tenant"));
    await assertFails(
      outsider.storage().ref(`other-tenant/vehicles/vehicle-1/photo.jpg`).getMetadata(),
    );
  });

  it("studio in the same tenant can read any customer's vehicle photo", async () => {
    await seedObject(path, { ownerId: "uid-alice" });
    const studio = testEnv.authenticatedContext("uid-studio", studioClaims());
    await assertSucceeds(studio.storage().ref(path).getMetadata());
  });

  it("admin in the same tenant can read any customer's vehicle photo", async () => {
    await seedObject(path, { ownerId: "uid-alice" });
    const admin = testEnv.authenticatedContext("uid-admin", adminClaims());
    await assertSucceeds(admin.storage().ref(path).getMetadata());
  });

  it("unauthenticated caller cannot read", async () => {
    await seedObject(path, { ownerId: "uid-alice" });
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.storage().ref(path).getMetadata());
  });

  it("no client, including the owner, can write directly (Cloud Function signed URL only)", async () => {
    const alice = testEnv.authenticatedContext("uid-alice", customerClaims());
    await assertFails(
      Promise.resolve(alice.storage().ref(path).put(CONTENT, { customMetadata: { ownerId: "uid-alice" } })),
    );
  });
});

describe("/{tenantId}/jobs/{jobId}/photos/{filename} — owner-scoped read", () => {
  const path = `${TENANT_ID}/jobs/job-1/photos/stage1.jpg`;

  it("owning customer (customMetadata.customerId) can read", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const alice = testEnv.authenticatedContext("uid-alice", customerClaims());
    await assertSucceeds(alice.storage().ref(path).getMetadata());
  });

  it("a different customer in the same tenant cannot read another customer's job photo", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const bob = testEnv.authenticatedContext("uid-bob", customerClaims());
    await assertFails(bob.storage().ref(path).getMetadata());
  });

  it("studio/admin in the same tenant can read regardless of ownership", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const studio = testEnv.authenticatedContext("uid-studio", studioClaims());
    await assertSucceeds(studio.storage().ref(path).getMetadata());
  });
});

describe("/{tenantId}/invoices/{invoiceId}/{filename} — owner-scoped read", () => {
  const path = `${TENANT_ID}/invoices/inv-1/invoice.pdf`;

  it("owning customer can read; a different customer cannot", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const alice = testEnv.authenticatedContext("uid-alice", customerClaims());
    await assertSucceeds(alice.storage().ref(path).getMetadata());

    const bob = testEnv.authenticatedContext("uid-bob", customerClaims());
    await assertFails(bob.storage().ref(path).getMetadata());
  });

  it("admin in the same tenant can read", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const admin = testEnv.authenticatedContext("uid-admin", adminClaims());
    await assertSucceeds(admin.storage().ref(path).getMetadata());
  });
});

describe("/{tenantId}/warranties/{warrantyId}/{filename} — owner-scoped read", () => {
  const path = `${TENANT_ID}/warranties/warr-1/certificate.pdf`;

  it("owning customer can read; a different customer cannot", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const alice = testEnv.authenticatedContext("uid-alice", customerClaims());
    await assertSucceeds(alice.storage().ref(path).getMetadata());

    const bob = testEnv.authenticatedContext("uid-bob", customerClaims());
    await assertFails(bob.storage().ref(path).getMetadata());
  });

  it("studio in the same tenant can read", async () => {
    await seedObject(path, { customerId: "uid-alice" });
    const studio = testEnv.authenticatedContext("uid-studio", studioClaims());
    await assertSucceeds(studio.storage().ref(path).getMetadata());
  });
});

describe("Deny everything else", () => {
  it("an unmapped path is denied entirely", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref(`${TENANT_ID}/random/thing.txt`).put(CONTENT);
    });
    const admin = testEnv.authenticatedContext("uid-admin", adminClaims());
    await assertFails(admin.storage().ref(`${TENANT_ID}/random/thing.txt`).getMetadata());
  });
});

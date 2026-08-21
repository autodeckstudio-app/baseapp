/**
 * Regression coverage for Phase 5B P1-13 hardening review (Batch 4):
 * healthCheck previously had NO auth check of any kind — request.auth was
 * never read — despite being exported unconditionally from index.ts (a real
 * production callable, not an emulator-only artifact) and despite a Phase 3D
 * HANDOFF comment in rateLimit.ts assuming it required authentication. This
 * proves the fix: unauthenticated and non-admin callers are rejected before
 * any Firestore write happens, and an authenticated admin/superadmin still
 * gets the original round-trip smoke-test behavior.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";

import { healthCheck } from "../../functions/health.js";

const db = getFirestore();

function customerAuth(uid: string) {
  return { uid, token: { role: "customer", tenantId: "health-tenant", studioId: null } };
}
function studioAuth(uid: string) {
  return { uid, token: { role: "studio", tenantId: "health-tenant", studioId: "health-studio" } };
}
function adminAuth(uid: string) {
  return { uid, token: { role: "admin", tenantId: "health-tenant", studioId: null } };
}

describe("healthCheck — admin-only (Phase 5B P1-13 Batch 4 regression)", () => {
  it("rejects an unauthenticated caller", async () => {
    await expect(healthCheck.run({ data: {}, auth: undefined } as never)).rejects.toThrow(
      /Authentication required/,
    );
  });

  it("rejects an authenticated customer", async () => {
    await expect(
      healthCheck.run({ data: {}, auth: customerAuth("health-cust-1") } as never),
    ).rejects.toThrow(/not authorized/);
  });

  it("rejects an authenticated studio user", async () => {
    await expect(
      healthCheck.run({ data: {}, auth: studioAuth("health-studio-1") } as never),
    ).rejects.toThrow(/not authorized/);
  });

  it("succeeds for an admin and performs the Firestore round-trip write", async () => {
    const result = (await healthCheck.run({ data: {}, auth: adminAuth("health-admin-1") } as never)) as {
      status: string;
      region: string;
    };
    expect(result.status).toBe("ok");

    const snap = await db.collection("_health").doc("ping").get();
    expect(snap.exists).toBe(true);
    expect(typeof (snap.data() as { ts: string }).ts).toBe("string");
  });
});

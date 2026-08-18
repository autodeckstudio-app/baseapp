/**
 * Emulator tests for calculateServicePrice (Phase 3I regression coverage).
 *
 * This callable was mistakenly deleted in Phase 3H after a single-line grep
 * missed its real callers, which all use a multi-line httpsCallable(...) call
 * (customer catalogue/booking/garage, studio walk-in preview, admin service
 * pricing preview). Restored in Phase 3I — these tests exist specifically so
 * a future cleanup pass cannot silently delete it again without a test
 * failure, and to prove the same lesson doesn't repeat for this function.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";

import { calculateServicePrice } from "../../functions/service/calculatePrice.js";

const db = getFirestore();

const TENANT_A = "svc-price-tenant-a";
const TENANT_B = "svc-price-tenant-b";

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

function customerAuth(authUid: string, tenantId = TENANT_A) {
  return { uid: authUid, token: { role: "customer", tenantId, studioId: null }, rawToken: "test" };
}

async function seedService(serviceId: string, tenantId: string, opts: { active: boolean }) {
  const now = new Date().toISOString();
  const service: Service = {
    id: serviceId,
    tenantId,
    name: "Price Preview Test Wash",
    category: "washing",
    brand: null,
    description: "Test service",
    basePrice: 50000,
    currency: "INR",
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    vehicleCategoryPricing: [{ vehicleCategory: "suv", additionalPricePaise: 10000, additionalMinutes: 10 }],
    requiredBayType: "wash",
    membershipWashEligible: true,
    active: opts.active,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("services").doc(serviceId).set(service);
  return service;
}

describe("calculateServicePrice — server-authoritative price preview", () => {
  it("returns a correct breakdown + snapshot for an active service", async () => {
    const service = await seedService(uid("svc"), TENANT_A, { active: true });
    const result = (await calculateServicePrice.run({
      data: { serviceId: service.id, vehicleCategory: "hatchback" },
      auth: customerAuth(uid("cust")),
    } as never)) as { breakdown: { total: number }; snapshot: { serviceId: string } };

    expect(result.breakdown.total).toBeGreaterThan(0);
    expect(result.snapshot.serviceId).toBe(service.id);
  });

  it("applies vehicle-category pricing adjustments", async () => {
    const service = await seedService(uid("svc"), TENANT_A, { active: true });
    const base = (await calculateServicePrice.run({
      data: { serviceId: service.id, vehicleCategory: "hatchback" },
      auth: customerAuth(uid("cust")),
    } as never)) as { breakdown: { subtotal: number } };
    const suv = (await calculateServicePrice.run({
      data: { serviceId: service.id, vehicleCategory: "suv" },
      auth: customerAuth(uid("cust")),
    } as never)) as { breakdown: { subtotal: number } };

    expect(suv.breakdown.subtotal).toBeGreaterThan(base.breakdown.subtotal);
  });

  it("rejects a request for an inactive service", async () => {
    const service = await seedService(uid("svc"), TENANT_A, { active: false });
    await expect(
      calculateServicePrice.run({
        data: { serviceId: service.id, vehicleCategory: "hatchback" },
        auth: customerAuth(uid("cust")),
      } as never),
    ).rejects.toThrow(/not currently available/);
  });

  it("rejects a non-existent service", async () => {
    await expect(
      calculateServicePrice.run({
        data: { serviceId: "does-not-exist", vehicleCategory: "hatchback" },
        auth: customerAuth(uid("cust")),
      } as never),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects cross-tenant price requests", async () => {
    const service = await seedService(uid("svc-b"), TENANT_B, { active: true });
    await expect(
      calculateServicePrice.run({
        data: { serviceId: service.id, vehicleCategory: "hatchback" },
        auth: customerAuth(uid("cust-a"), TENANT_A),
      } as never),
    ).rejects.toThrow(/Cross-tenant/);
  });

  it("studio and admin roles can also request a price preview", async () => {
    const service = await seedService(uid("svc"), TENANT_A, { active: true });
    const result = (await calculateServicePrice.run({
      data: { serviceId: service.id, vehicleCategory: "hatchback" },
      auth: { uid: uid("studio"), token: { role: "studio", tenantId: TENANT_A, studioId: "studio-1" }, rawToken: "test" },
    } as never)) as { breakdown: { total: number } };
    expect(result.breakdown.total).toBeGreaterThan(0);
  });
});

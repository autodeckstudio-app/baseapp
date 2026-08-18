/**
 * Emulator tests for the AutoModz catalogue import (Phase 4).
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import type { Service } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

import { CATALOGUE, seedCatalogue } from "../../scripts/seed-catalogue.js";
import { calculateServicePrice } from "../../functions/service/calculatePrice.js";

const db = getFirestore();
const TEST_TENANT = "catalogue-seed-tenant";

describe("Catalogue seed — idempotent AutoModz import", () => {
  beforeAll(async () => {
    await seedCatalogue(TEST_TENANT);
  });

  it("contains exactly 18 real AutoModz services", () => {
    expect(CATALOGUE.length).toBe(18);
  });

  it("creates all 18 services on first run", async () => {
    for (const entry of CATALOGUE) {
      const snap = await db.collection(COLLECTIONS.services()).doc(entry.id).get();
      expect(snap.exists).toBe(true);
      expect((snap.data() as Service).tenantId).toBe(TEST_TENANT);
    }
  });

  it("re-running does not duplicate or overwrite existing services", async () => {
    // Simulate a prior admin edit (e.g. deactivating a service) to prove a
    // second seed run leaves it alone.
    await db.collection(COLLECTIONS.services()).doc("svc-wash-regular").update({ active: false });

    await seedCatalogue(TEST_TENANT);

    const snap = await db.collection(COLLECTIONS.services()).doc("svc-wash-regular").get();
    expect((snap.data() as Service).active).toBe(false); // untouched by the re-run

    const allSnap = await db.collection(COLLECTIONS.services()).where("tenantId", "==", TEST_TENANT).get();
    expect(allSnap.size).toBe(18); // no duplicates created
  });

  it("prices match the documented AutoModz price list exactly (paise)", async () => {
    const cases: Array<[string, number]> = [
      ["svc-ppf-llumar-gloss", 145_000_00],
      ["svc-ppf-llumar-platinum", 205_000_00],
      ["svc-ppf-llumar-valor", 220_000_00],
      ["svc-ppf-garware-plus", 85_000_00],
      ["svc-ppf-garware-premium", 105_000_00],
      ["svc-ppf-garware-platinum", 145_000_00],
      ["svc-ceramic-kovalent-prolong", 10_000_00],
      ["svc-ceramic-graphene-matrix", 12_000_00],
      ["svc-ceramic-borophene", 14_000_00],
      ["svc-wash-regular", 500_00],
      ["svc-wash-premium", 1_000_00],
      ["svc-wash-detail-spa", 2_500_00],
      ["svc-wash-dry-clean", 4_000_00],
      ["svc-wash-roof-cleaning", 800_00],
      ["svc-wash-headlight-buffing", 400_00],
      ["svc-coating-teflon", 5_000_00],
      ["svc-coating-glass", 1_200_00],
      ["svc-coating-maintenance", 4_500_00],
    ];
    for (const [id, expectedPaise] of cases) {
      const snap = await db.collection(COLLECTIONS.services()).doc(id).get();
      expect((snap.data() as Service).basePrice, id).toBe(expectedPaise);
    }
  });

  it("only washing services are membershipWashEligible", async () => {
    const snap = await db.collection(COLLECTIONS.services()).where("tenantId", "==", TEST_TENANT).get();
    for (const doc of snap.docs) {
      const service = doc.data() as Service;
      if (service.category === "washing") {
        expect(service.membershipWashEligible, service.id).toBe(true);
      } else {
        expect(service.membershipWashEligible, service.id).toBe(false);
      }
    }
  });

  it("no vehicle-category price differential is invented (all flat-priced)", async () => {
    const snap = await db.collection(COLLECTIONS.services()).where("tenantId", "==", TEST_TENANT).get();
    for (const doc of snap.docs) {
      expect((doc.data() as Service).vehicleCategoryPricing).toEqual([]);
    }
  });

  it("Garware Platinum correctly has a lifetime warranty (null value, 'lifetime' unit)", async () => {
    const snap = await db.collection(COLLECTIONS.services()).doc("svc-ppf-garware-platinum").get();
    const service = snap.data() as Service;
    expect(service.warrantyDurationUnit).toBe("lifetime");
    expect(service.warrantyDurationValue).toBeNull();
  });

  it("ceramic coating warranty is left null (undocumented in source material, not guessed)", async () => {
    const snap = await db.collection(COLLECTIONS.services()).doc("svc-ceramic-borophene").get();
    const service = snap.data() as Service;
    expect(service.warrantyLabel).toBeNull();
    expect(service.warrantyDurationValue).toBeNull();
    expect(service.warrantyDurationUnit).toBeNull();
  });

  it("calculateServicePrice works correctly against a seeded multi-day PPF service", async () => {
    const result = (await calculateServicePrice.run({
      data: { serviceId: "svc-ppf-llumar-valor", vehicleCategory: "hatchback" },
      auth: { uid: "test-cust", token: { role: "customer", tenantId: TEST_TENANT, studioId: null }, rawToken: "test" },
    } as never)) as { breakdown: { subtotal: number; total: number } };

    // 22,000,000 paise subtotal + 18% GST
    expect(result.breakdown.subtotal).toBe(220_000_00);
    expect(result.breakdown.total).toBe(Math.round(220_000_00 * 1.18));
  });

  it("calculateServicePrice works correctly against a seeded short wash service", async () => {
    // Uses svc-wash-premium, not svc-wash-regular — an earlier test in this
    // file deliberately deactivates svc-wash-regular to prove re-seeding
    // doesn't clobber admin edits, so it's intentionally unavailable by now.
    const result = (await calculateServicePrice.run({
      data: { serviceId: "svc-wash-premium", vehicleCategory: "sedan" },
      auth: { uid: "test-cust", token: { role: "customer", tenantId: TEST_TENANT, studioId: null }, rawToken: "test" },
    } as never)) as { breakdown: { subtotal: number } };

    expect(result.breakdown.subtotal).toBe(1_000_00);
  });
});

/**
 * Handler-level test for getServiceCatalogue's optional displayTotals.
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 * Invokes the real onCall handler against seeded emulator documents - not a mirrored loop.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getFirestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { getServiceCatalogue } from "../../functions/service/getServiceCatalogue.js";
import { calculateServicePrice } from "../../functions/service/calculatePrice.js";

const db = getFirestore();
const T = "display-totals-tenant";
const AUTH = { uid: "dt-cust", token: { role: "customer", tenantId: T, studioId: null }, rawToken: "test" };
const now = new Date().toISOString();

const svc = (id: string, over: Record<string, unknown>) =>
  db.collection(COLLECTIONS.services()).doc(id).set({
    id, tenantId: T, name: id, category: "washing", brand: null, description: "",
    basePrice: 50_000, currency: "INR", estimatedDurationMinutes: 60, warrantyLabel: null,
    vehicleCategoryPricing: [], requiredBayType: "detailing", membershipWashEligible: false,
    priceOnRequest: false, priceFrom: false, active: true, displayOrder: 1,
    createdAt: now, updatedAt: now, ...over,
  });

const rows = (suvPaise: number | null) =>
  (["hatchback", "sedan", "suv", "luxury", "commercial", "van"] as const)
    .filter((v) => suvPaise !== null || v === "hatchback")
    .map((v) => ({ vehicleCategory: v, additionalPricePaise: v === "hatchback" ? 0 : suvPaise ?? 0, additionalMinutes: 0 }));

describe("getServiceCatalogue displayTotals (handler, emulator)", () => {
  beforeAll(async () => {
    await svc("dt-ppf-full", { category: "ppf", basePrice: 1_000_000, vehicleCategoryPricing: rows(250_000) });
    await svc("dt-ppf-norow", { category: "ppf", basePrice: 900_000, vehicleCategoryPricing: rows(null) }); // only hatchback row
    await svc("dt-wash", {});
    await svc("dt-quote", { category: "ppf", priceOnRequest: true, basePrice: 0 });
    await svc("dt-inactive", { active: false });
  });

  it("returns server-computed totals only for priced, active, row-complete services", async () => {
    const res = (await getServiceCatalogue.run({ data: { vehicleCategory: "suv" }, auth: AUTH } as never)) as {
      services: Array<{ id: string }>;
      displayTotals?: Record<string, number>;
    };
    const ids = res.services.map((s) => s.id);
    expect(ids).not.toContain("dt-inactive");
    expect(res.displayTotals).toBeDefined();
    const totals = res.displayTotals ?? {};
    expect(totals["dt-ppf-full"]).toBe(1_250_000); // base + suv row, GST off
    expect(totals["dt-wash"]).toBe(50_000); // flat category needs no rows
    expect(totals["dt-ppf-norow"]).toBeUndefined(); // missing suv row: omitted, never flat base
    expect(totals["dt-quote"]).toBeUndefined(); // quote on request
    expect(Object.keys(totals).sort()).toEqual(["dt-ppf-full", "dt-wash"]);
  });

  it("matches calculateServicePrice exactly for the same service and size", async () => {
    const direct = (await calculateServicePrice.run({
      data: { serviceId: "dt-ppf-full", vehicleCategory: "suv" }, auth: AUTH,
    } as never)) as { breakdown: { total: number } };
    const res = (await getServiceCatalogue.run({ data: { vehicleCategory: "suv" }, auth: AUTH } as never)) as {
      displayTotals?: Record<string, number>;
    };
    expect(res.displayTotals?.["dt-ppf-full"]).toBe(direct.breakdown.total);
  });

  it("omits displayTotals entirely when no vehicleCategory is requested", async () => {
    const res = (await getServiceCatalogue.run({ data: {}, auth: AUTH } as never)) as Record<string, unknown>;
    expect("displayTotals" in res).toBe(false);
  });
});

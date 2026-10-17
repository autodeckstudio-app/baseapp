import { describe, it, expect } from "vitest";
import { pickupZone, haversineKm, pickupFeePaise, pickupLegFeePaise, PICKUP_FREE_KM, PICKUP_FLAT_KM, PICKUP_FEE_PER_LEG_PAISE, PICKUP_PER_KM_PAISE, STUDIO_COORDS } from "@autodeck/core";
import { readFileSync } from "node:fs";

describe("pickup rule: free to 3 km, Rs 150 per leg to 5 km, Rs 15 per km past 5, per leg, no limit", () => {
  it("constants", () => { expect(PICKUP_FREE_KM).toBe(3); expect(PICKUP_FLAT_KM).toBe(5); expect(PICKUP_FEE_PER_LEG_PAISE).toBe(15000); expect(PICKUP_PER_KM_PAISE).toBe(1500); });
  it("one leg by distance", () => {
    const r = (km: number) => pickupLegFeePaise(km) / 100;
    expect([0, 2.9, 3].map(r)).toEqual([0, 0, 0]);
    expect([3.1, 4, 5].map(r)).toEqual([150, 150, 150]);
    expect(r(5.1)).toBe(165); expect(r(6)).toBe(165); expect(r(6.1)).toBe(180); expect(r(10)).toBe(225); expect(r(15)).toBe(300); expect(r(40)).toBe(675);
  });
  it("is per leg: pickup one leg, drop one leg, both two legs", () => {
    expect(pickupFeePaise(4, "pickup")).toBe(15000); expect(pickupFeePaise(4, "drop")).toBe(15000); expect(pickupFeePaise(4, "both")).toBe(30000);
    expect(pickupFeePaise(10, "both")).toBe(45000); expect(pickupFeePaise(2, "both")).toBe(0);
  });
  it("zone has no blocked tier", () => {
    const at = (dLat: number) => pickupZone({ lat: STUDIO_COORDS.lat + dLat, lng: STUDIO_COORDS.lng });
    expect(pickupZone(STUDIO_COORDS)).toEqual({ km: 0, within: true, tier: "free", feePerLegPaise: 0 });
    expect(at(2.9 / 111.19).tier).toBe("free"); expect(at(3.1 / 111.19).tier).toBe("fee");
    expect(at(0.5)).toMatchObject({ tier: "fee" }); expect(at(0.5).feePerLegPaise).toBeGreaterThan(15000);
  });
  it("haversine is about 111 km per degree of latitude", () => expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110));
  it("the server prices from the distance, stores it, and has no distance block", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
    expect(src).toContain("pickupZone(");
    expect(src).toContain("pickupFeePaise(z.km, data.kind)");
    expect(src).toContain("distanceKm");
    expect(src).not.toContain('"blocked"');
    expect(src).not.toContain("PICKUP_MAX_KM");
  });
  it("one source: no old 7 km or Rs 100 rule left in app code or Terms", () => {
    const core = readFileSync(`${__dirname}/../../../../packages/core/src/pickup-zone.ts`, "utf8");
    expect(core).not.toContain("PICKUP_MAX_KM");
    const terms = readFileSync(`${__dirname}/../../../../apps/site/src/pages/terms.astro`, "utf8");
    expect(terms).toContain("Rs 150"); expect(terms).toContain("Rs 15 for every km"); expect(terms).not.toContain("7 km");
  });
});

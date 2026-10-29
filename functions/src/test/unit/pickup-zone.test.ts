import { describe, it, expect } from "vitest";
import { pickupZone, haversineKm, pickupFeePaise, pickupLegFeePaise, PICKUP_NEAR_KM, PICKUP_NEAR_FEE_PAISE, PICKUP_FAR_FEE_PAISE, STUDIO_COORDS } from "@autodeck/core";
import { readFileSync } from "node:fs";

describe("pickup rule v3: under 3 km Rs 100, 3 km and above Rs 150, per leg, no limit", () => {
  it("constants", () => { expect(PICKUP_NEAR_KM).toBe(3); expect(PICKUP_NEAR_FEE_PAISE).toBe(10000); expect(PICKUP_FAR_FEE_PAISE).toBe(15000); });
  it("one leg by distance, exactly 3.0 km is Rs 150, no per km", () => {
    const r = (km: number) => pickupLegFeePaise(km) / 100;
    expect([0, 1, 2.9].map(r)).toEqual([100, 100, 100]);
    expect([3, 3.1, 5, 6, 10, 40].map(r)).toEqual([150, 150, 150, 150, 150, 150]);
  });
  it("is per leg: pickup one leg, drop one leg, both two legs", () => {
    expect(pickupFeePaise(2, "pickup")).toBe(10000); expect(pickupFeePaise(2, "both")).toBe(20000);
    expect(pickupFeePaise(4, "drop")).toBe(15000); expect(pickupFeePaise(4, "both")).toBe(30000); expect(pickupFeePaise(30, "both")).toBe(30000);
  });
  it("zone: two bands, no blocked tier, fee read from the rounded distance", () => {
    const at = (dLat: number) => pickupZone({ lat: STUDIO_COORDS.lat + dLat, lng: STUDIO_COORDS.lng });
    expect(pickupZone(STUDIO_COORDS)).toEqual({ km: 0, tier: "near", feePerLegPaise: 10000 });
    expect(at(2.9 / 111.19).tier).toBe("near"); expect(at(3.1 / 111.19).tier).toBe("far");
    expect(at(0.5)).toMatchObject({ tier: "far", feePerLegPaise: 15000 });
  });
  it("haversine is about 111 km per degree of latitude", () => expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110));
  it("the server prices from the distance, stores it, and has no distance block", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
    expect(src).toContain("pickupZone(");
    expect(src).toContain("pickupFeePaise(zone.km, data.kind)");
    expect(src).toContain("distanceKm");
    expect(src).not.toContain('"blocked"');
    expect(src).not.toContain("PICKUP_MAX_KM");
  });
  it("one source: no old 7 km or Rs 100 rule left in app code or Terms", () => {
    const core = readFileSync(`${__dirname}/../../../../packages/core/src/pickup-zone.ts`, "utf8");
    expect(core).not.toContain("PICKUP_MAX_KM");
    // The public Terms page carries only the approved neutral sentence (imported terms.html);
    // pickup fees are shown config-driven in the app, so NO pickup numbers belong on the page.
    const terms = readFileSync(`${__dirname}/../../../../apps/site/src/data/redesign/terms.html`, "utf8");
    expect(terms).toContain("For cancellation, refund, pickup, warranty or membership terms, please contact AutoDeck before confirming your booking.");
    expect(terms).not.toContain("Rs 100"); expect(terms).not.toContain("Rs 150"); expect(terms).not.toContain("every km"); expect(terms).not.toContain("7 km"); expect(terms).not.toContain("free within");
  });
});

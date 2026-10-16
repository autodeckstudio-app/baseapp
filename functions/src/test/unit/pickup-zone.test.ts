import { describe, it, expect } from "vitest";
import { pickupZone, haversineKm, PICKUP_FREE_KM, STUDIO_COORDS } from "@autodeck/core";
import { readFileSync } from "node:fs";

describe("pickup free zone", () => {
  it("free zone is 3 km", () => expect(PICKUP_FREE_KM).toBe(3));
  it("the studio itself is inside", () => expect(pickupZone(STUDIO_COORDS)).toEqual({ km: 0, within: true, tier: "free", feePerLegPaise: 0 }));
  it("a point about 1 km away is inside, one about 6 km away is outside", () => {
    expect(pickupZone({ lat: STUDIO_COORDS.lat + 0.009, lng: STUDIO_COORDS.lng }).within).toBe(true);
    expect(pickupZone({ lat: STUDIO_COORDS.lat + 0.054, lng: STUDIO_COORDS.lng }).within).toBe(false);
  });
  it("haversine is about 111 km per degree of latitude", () => expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110));
  it("the server callable enforces the zone and stores the distance", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
    expect(src).toContain("pickupZone(");
    expect(src).toContain("failed-precondition");
    expect(src).toContain("distanceKm");
  });
});

import { pickupFeePaise, PICKUP_MAX_KM, PICKUP_FEE_PER_LEG_PAISE } from "@autodeck/core";
describe("pickup fee tiers", () => {
  const at = (dLat: number) => pickupZone({ lat: STUDIO_COORDS.lat + dLat, lng: STUDIO_COORDS.lng });
  it("constants: free to 3 km, Rs 100 per leg to 7 km", () => { expect(PICKUP_MAX_KM).toBe(7); expect(PICKUP_FEE_PER_LEG_PAISE).toBe(10000); });
  it("2 km is free, 6 km is the flat fee, 10 km is blocked", () => {
    expect(at(0.018)).toMatchObject({ tier: "free", feePerLegPaise: 0 });
    expect(at(0.054)).toMatchObject({ tier: "fee", feePerLegPaise: 10000 });
    expect(at(0.09)).toMatchObject({ tier: "blocked", feePerLegPaise: 0 });
  });
  it("just inside and just outside each edge", () => {
    expect(at(2.9 / 111.19).tier).toBe("free");
    expect(at(3.1 / 111.19).tier).toBe("fee");
    expect(at(6.9 / 111.19).tier).toBe("fee");
    expect(at(7.1 / 111.19).tier).toBe("blocked");
  });
  it("the server stores the fee and blocks beyond the maximum", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
    expect(src).toContain('z.tier === "blocked"');
    expect(src).toContain("feePaise");
  });
});

describe("pickup fee per leg", () => {
  it("pickup 100, drop 100, both 200, only between 3 and 7 km", () => {
    expect(pickupFeePaise("fee", "pickup")).toBe(10000);
    expect(pickupFeePaise("fee", "drop")).toBe(10000);
    expect(pickupFeePaise("fee", "both")).toBe(20000);
    expect(pickupFeePaise("free", "both")).toBe(0);
    expect(pickupFeePaise("blocked", "both")).toBe(0);
  });
  it("the server prices the fee from the request kind", () => {
    const src = readFileSync(`${__dirname}/../../functions/booking/pickupRequests.ts`, "utf8");
    expect(src).toContain("pickupFeePaise(z.tier, data.kind)");
  });
});

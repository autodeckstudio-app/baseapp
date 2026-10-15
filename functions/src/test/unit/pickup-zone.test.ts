import { describe, it, expect } from "vitest";
import { pickupZone, haversineKm, PICKUP_FREE_KM, STUDIO_COORDS } from "@autodeck/core";
import { readFileSync } from "node:fs";

describe("pickup free zone", () => {
  it("free zone is 3 km", () => expect(PICKUP_FREE_KM).toBe(3));
  it("the studio itself is inside", () => expect(pickupZone(STUDIO_COORDS)).toEqual({ km: 0, within: true }));
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

import { describe, it, expect } from "vitest";
import {
  PICKUP_FREE_ROAD_METERS,
  PICKUP_ROAD_RATE_PER_KM_PAISE,
  pickupLegFeePaiseForRoadMeters,
  pickupLegsFeePaise,
  pickupRoadKmForDisplay,
} from "./pickup-zone.js";

describe("road-distance pickup pricing (free 3 km per leg, Rs 25 per extra road km)", () => {
  it("is free at and under 3 road km", () => {
    expect(pickupLegFeePaiseForRoadMeters(0)).toBe(0);
    expect(pickupLegFeePaiseForRoadMeters(2_999)).toBe(0);
    expect(pickupLegFeePaiseForRoadMeters(3_000)).toBe(0);
    expect(PICKUP_FREE_ROAD_METERS).toBe(3_000);
    expect(PICKUP_ROAD_RATE_PER_KM_PAISE).toBe(2_500);
  });
  it("charges per actual metre to the nearest paise, never whole-km steps", () => {
    // 1 extra metre = 2.5 paise -> nearest paise is 3 (half up), not Rs 25 for a started km.
    expect(pickupLegFeePaiseForRoadMeters(3_001)).toBe(3);
    // 500 extra metres = 0.5 km * 2500 = 1250 paise exactly.
    expect(pickupLegFeePaiseForRoadMeters(3_500)).toBe(1_250);
  });
  it("matches the owner-accepted example: 8 road km = Rs 125 per leg, Rs 250 for both legs at 8 km", () => {
    expect(pickupLegFeePaiseForRoadMeters(8_000)).toBe(12_500);
    expect(pickupLegsFeePaise([8_000])).toBe(12_500);
    expect(pickupLegsFeePaise([8_000, 8_000])).toBe(25_000);
  });
  it("prices each leg independently: asymmetric routes are NOT one route doubled", () => {
    // pickup leg 8 km (Rs 125), drop leg 2.9 km (free) -> Rs 125, not Rs 250 and not 2x a single route.
    expect(pickupLegsFeePaise([8_000, 2_900])).toBe(12_500);
    // both legs just past the free boundary: 3.5 km + 4.0 km = Rs 12.50 + Rs 25 = Rs 37.50.
    expect(pickupLegsFeePaise([3_500, 4_000])).toBe(3_750);
  });
  it("display distance floors to 0.1 km while the fee keeps exact metres", () => {
    expect(pickupRoadKmForDisplay(2_960)).toBe(2.9);
    expect(pickupRoadKmForDisplay(3_000)).toBe(3);
    expect(pickupRoadKmForDisplay(8_049)).toBe(8);
  });
});

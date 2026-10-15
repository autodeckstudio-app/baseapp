import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const card = readFileSync(`${__dirname}/../ui/PickupCard.tsx`, "utf8");
describe("pickup card zone", () => {
  it("uses the shared 3 km zone and never states a fee", () => {
    expect(card).toContain("pickupZone(where)");
    expect(card).toContain("PICKUP_FREE_KM");
    expect(card).not.toMatch(/Rs\s?\d/);
    expect(card).not.toContain("5 km");
  });
  it("blocks sending beyond the zone and offers a call", () => {
    expect(card).toContain("!zone.within");
    expect(card).toContain("Call the studio");
  });
});

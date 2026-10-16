import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const card = readFileSync(`${__dirname}/../ui/PickupCard.tsx`, "utf8");
describe("pickup card zone", () => {
  it("takes the zone, fee and limits from the shared core, with no fee typed in the card", () => {
    expect(card).toContain("pickupZone(where)");
    expect(card).toContain("pickupFeePaise");
    expect(card).toContain("PICKUP_MAX_KM");
    expect(card).not.toMatch(/Rs\s?\d/);
    expect(card).not.toContain("5 km");
  });
  it("blocks sending only beyond the maximum and offers a call", () => {
    expect(card).toContain('zone?.tier === "blocked"');
    expect(card).toContain("Call the studio");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const card = readFileSync(`${__dirname}/../ui/PickupCard.tsx`, "utf8");
describe("pickup card zone", () => {
  it("takes the zone, fee and limits from the shared core, with no fee typed in the card", () => {
    expect(card).toContain("pickupZone(where)");
    expect(card).toContain("pickupFeePaise");
    expect(card).toContain("PICKUP_PER_KM_PAISE");
    expect(card).not.toMatch(/Rs\s?\d/);
  });
  it("has no distance limit, so it never blocks a request or tells the customer to call", () => {
    expect(card).not.toContain("blocked");
    expect(card).not.toContain("PICKUP_MAX_KM");
    expect(card).not.toContain("Call the studio");
  });
});

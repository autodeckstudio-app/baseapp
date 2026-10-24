import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const card = readFileSync(`${__dirname}/../ui/PickupCard.tsx`, "utf8");
const confirm = readFileSync(`${__dirname}/../app/(tabs)/book/confirm.tsx`, "utf8");
const policy = readFileSync(`${__dirname}/pickup-policy.ts`, "utf8");
describe("pickup zone and fee", () => {
  it("the booking-flow section takes the zone and fee from the shared core, with no fee typed in the screen", () => {
    expect(confirm).toContain("pickupZone(pickupWhere)");
    expect(confirm).toContain("pickupFeeText(pickupZoneInfo.km, pickupKind)");
    expect(policy).toContain("pickupFeePaise");
    expect(policy).toContain("PICKUP_FAR_FEE_PAISE");
    expect(confirm).not.toMatch(/Rs\s?\d/);
  });
  it("the status card shares the same policy wording and types no fee itself", () => {
    expect(card).toContain("PICKUP_POLICY");
    expect(card).not.toMatch(/Rs\s?\d/);
  });
  it("has no distance limit, so it never blocks a request or tells the customer to call", () => {
    expect(confirm).not.toContain("blocked");
    expect(confirm).not.toContain("PICKUP_MAX_KM");
    expect(policy).not.toContain("PICKUP_MAX_KM");
    expect(card).not.toContain("blocked");
    expect(card).not.toContain("PICKUP_MAX_KM");
  });
});

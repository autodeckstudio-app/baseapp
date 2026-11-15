import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const card = readFileSync(`${__dirname}/../ui/PickupCard.tsx`, "utf8");
const confirm = readFileSync(`${__dirname}/../app/(tabs)/book/confirm.tsx`, "utf8");
const policy = readFileSync(`${__dirname}/pickup-policy.ts`, "utf8");
describe("pickup road-distance quote flow", () => {
  it("the booking flow prices only through the server quote, with no fee or distance typed in the screen", () => {
    expect(confirm).toContain("getPickupQuote({ kind: pickupKind");
    expect(confirm).toContain("describePickupQuote(pickupQuoteInfo)");
    expect(confirm).toContain("quoteId: pickupQuoteInfo.quoteId");
    expect(policy).toContain("final pickup/drop fee");
    expect(policy).not.toContain("per extra km");
    expect(confirm).not.toMatch(/Rs\s?\d/);
  });
  it("never estimates on routing failure: honest copy, no charge path", () => {
    expect(confirm).toContain("could not check the road distance");
    expect(confirm).not.toContain("pickupZone(pickupWhere)");
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

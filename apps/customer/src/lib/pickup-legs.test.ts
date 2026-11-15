import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { completedLegRows } from "./pickup-legs";
describe("customer pickup leg visibility", () => {
  it("shows nothing for legacy requests without timestamps", () => {
    expect(completedLegRows({ kind: "both", status: "CONFIRMED" })).toEqual([]);
    expect(completedLegRows({ kind: "both", status: "CONFIRMED", pickupCompletedAt: null, dropCompletedAt: null })).toEqual([]);
  });
  it("shows only the legs that are done, for the legs the request has", () => {
    expect(completedLegRows({ kind: "both", status: "CONFIRMED", pickupCompletedAt: "2026-10-26T04:30:00Z" })).toEqual([{ title: "Car picked up", at: "2026-10-26T04:30:00Z" }]);
    expect(completedLegRows({ kind: "pickup", status: "DONE", pickupCompletedAt: "2026-10-26T04:30:00Z", dropCompletedAt: "2026-10-26T09:00:00Z" }).map((r) => r.title)).toEqual(["Car picked up"]);
  });
  it("ignores requested or declined requests and bad timestamps", () => {
    expect(completedLegRows({ kind: "pickup", status: "REQUESTED", pickupCompletedAt: "2026-10-26T04:30:00Z" })).toEqual([]);
    expect(completedLegRows({ kind: "pickup", status: "DECLINED", pickupCompletedAt: "2026-10-26T04:30:00Z" })).toEqual([]);
    expect(completedLegRows({ kind: "pickup", status: "CONFIRMED", pickupCompletedAt: "nope" })).toEqual([]);
  });
  it("the card stays read-only, keeps the payment line and implies no delivery or charge", () => {
    const c = readFileSync("src/ui/PickupCard.tsx", "utf8");
    expect(c).toContain("completedLegRows(req)");
    expect(c).toContain("Nothing is charged online.");
    expect(c).not.toMatch(/httpsCallable|advanceJobStatus|delivered/i);
  });
});

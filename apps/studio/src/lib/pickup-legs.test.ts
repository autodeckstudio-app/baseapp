import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legsFor, canMarkLeg, legPayload, outstandingNote } from "./pickup-legs";
import { PICKUP_LEG_PROGRESS_ENABLED } from "./backend-features";
describe("pickup leg progress", () => {
  it("is enabled with the pickup-leg backend", () => expect(PICKUP_LEG_PROGRESS_ENABLED).toBe(true));
  it("lists the legs a kind has", () => {
    expect(legsFor({ kind: "both", status: "CONFIRMED" }).map((l) => l.leg)).toEqual(["pickup", "drop"]);
    expect(legsFor({ kind: "drop", status: "CONFIRMED" }).map((l) => l.leg)).toEqual(["drop"]);
  });
  it("marks only an open leg of a CONFIRMED request", () => {
    expect(canMarkLeg({ kind: "both", status: "CONFIRMED" }, "drop")).toBe(true);
    expect(canMarkLeg({ kind: "pickup", status: "CONFIRMED" }, "drop")).toBe(false);
    expect(canMarkLeg({ kind: "both", status: "CONFIRMED", dropCompletedAt: "2026-10-26T10:00:00Z" }, "drop")).toBe(false);
    for (const s of ["REQUESTED", "DONE", "DECLINED"]) expect(canMarkLeg({ kind: "both", status: s }, "pickup")).toBe(false);
  });
  it("sends the current CONFIRMED status with the leg and nothing else", () => {
    expect(legPayload("r1", "pickup")).toEqual({ requestId: "r1", status: "CONFIRMED", markLegCompleted: "pickup" });
  });
  it("shows an outstanding drop honestly and never implies delivery", () => {
    expect(outstandingNote({ kind: "both", status: "CONFIRMED", pickupCompletedAt: "x" })).toBe("Drop back still to do.");
    expect(outstandingNote({ kind: "both", status: "CONFIRMED", pickupCompletedAt: "x", dropCompletedAt: "y" })).toMatch(/Mark the request done when you are ready/);
    const src = readFileSync(join(__dirname, "../app/(tabs)/pickups.tsx"), "utf8");
    expect(src).toContain("PICKUP_LEG_PROGRESS_ENABLED && confirmed");
    expect(src).not.toMatch(/advanceJobStatus|DELIVERED/);
  });
});

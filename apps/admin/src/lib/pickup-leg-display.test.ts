import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { doneLegLines, outstandingLegNote } from "./pickup-leg-display";
const f = (s: string) => `T:${s}`;
describe("admin pickup leg visibility (read-only)", () => {
  it("shows nothing for older requests with no timestamps", () => {
    expect(doneLegLines({ kind: "both", status: "CONFIRMED" }, f)).toEqual([]);
    expect(outstandingLegNote({ kind: "both", status: "CONFIRMED" })).toBeNull();
  });
  it("lists only recorded legs the kind has, for CONFIRMED or DONE", () => {
    expect(doneLegLines({ kind: "both", status: "CONFIRMED", pickupCompletedAt: "2026-10-26T04:30:00Z" }, f)).toEqual([["Pickup done", "T:2026-10-26T04:30:00Z"]]);
    expect(doneLegLines({ kind: "drop", status: "DONE", pickupCompletedAt: "2026-10-26T04:30:00Z", dropCompletedAt: "2026-10-26T12:30:00Z" }, f).map((l) => l[0])).toEqual(["Drop done"]);
    expect(doneLegLines({ kind: "pickup", status: "REQUESTED", pickupCompletedAt: "2026-10-26T04:30:00Z" }, f)).toEqual([]);
  });
  it("names the outstanding leg of a two-leg request", () => {
    expect(outstandingLegNote({ kind: "both", status: "CONFIRMED", pickupCompletedAt: "2026-10-26T04:30:00Z" })).toBe("Drop still to do");
    expect(outstandingLegNote({ kind: "both", status: "CONFIRMED", pickupCompletedAt: "2026-10-26T04:30:00Z", dropCompletedAt: "2026-10-26T12:30:00Z" })).toBeNull();
  });
  it("the page keeps its status actions and does not call any new function", () => {
    const p = readFileSync(join(__dirname, "../app/(admin)/pickups/page.tsx"), "utf8");
    expect(p).toContain("doneLegLines(r, formatAgreed)");
    expect(p).not.toMatch(/markLegCompleted|advanceJobStatus|recordManualPayment/);
    expect(readFileSync(join(__dirname, "pickup-service.ts"), "utf8")).not.toContain("markLegCompleted");
  });
});

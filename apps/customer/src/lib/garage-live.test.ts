import { describe, expect, it } from "vitest";
import { careRing, jobStep, liveJobForCar, readyBy } from "./garage-live";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (p: string) => readFileSync(resolve(".", "src", p.replace(/^\.\.\//, "")), "utf8");

describe("garage live job", () => {
  const jobs = [{ id: "a", status: "DELIVERED", vehicleId: "v1" }, { id: "b", status: "IN_PROGRESS", vehicleId: "v2" }, { id: "c", status: "QUALITY_CHECK", vehicleId: "v1" }];
  it("finds the live job of that car only", () => { expect(liveJobForCar(jobs, "v1")?.id).toBe("c"); expect(liveJobForCar(jobs, "v2")?.id).toBe("b"); expect(liveJobForCar(jobs, "v3")).toBeNull(); });
  it("a delivered job is not live", () => { expect(liveJobForCar([jobs[0]!], "v1")).toBeNull(); });
  it("maps status to the four steps", () => { expect(jobStep("VEHICLE_RECEIVED")).toBe(0); expect(jobStep("IN_PROGRESS")).toBe(2); expect(jobStep("READY_FOR_DELIVERY")).toBe(3); });
  it("ready-by only when set and ahead", () => { expect(readyBy({})).toBeNull(); expect(readyBy({ estimatedEndAt: "2020-01-01T00:00:00Z" })).toBeNull(); expect(readyBy({ estimatedEndAt: new Date(Date.now() + 3600_000).toISOString() })).not.toBeNull(); });
});
describe("care ring", () => {
  const now = new Date("2026-10-18T00:00:00Z").getTime();
  it("shows washes left of total and days left", () => {
    const r = careRing({ status: "active", washesTotal: 4, washesUsed: 1, endDate: "2026-11-01T00:00:00Z", tier: "silver" }, now)!;
    expect(r.left).toBe(3); expect(r.fraction).toBe(0.75); expect(r.line).toBe("Silver, 14 days left"); expect(r.sub).toBe("3 of 4 washes left");
  });
  it("is absent without an active plan", () => { expect(careRing(null)).toBeNull(); expect(careRing({ status: "expired", washesTotal: 4, washesUsed: 0 })).toBeNull(); });
  it("never goes negative", () => { expect(careRing({ status: "active", washesTotal: 2, washesUsed: 5 }, now)!.left).toBe(0); });
});
describe("garage showroom guards", () => {
  const g = read("../app/(tabs)/garage/index.tsx"); const s = read("../ui/GarageShowroom.tsx");
  it("keeps the All chip and the due chip", () => { expect(g).toContain('label: "All"'); expect(g).toContain("dueChip("); });
  it("has one Book a service button", () => { expect((g.match(/label="Book a service"/g) ?? []).length).toBe(1); });
  it("respects Reduce Motion in every animation", () => { expect(s).toContain("useReduceMotion"); expect(read("../ui/CareRing.tsx")).toContain("useReduceMotion"); });
  it("uses only allowed radii and no emoji", () => { expect(s).not.toMatch(/borderRadius: (?!12|16|24|9999|0\b)\d+/); });
});

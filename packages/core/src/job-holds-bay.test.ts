import { describe, it, expect } from "vitest";
import { jobHoldsBay } from "./constants";

const end = "2026-10-19T07:00:00.000Z";
const at = (iso: string) => Date.parse(iso);
describe("jobHoldsBay", () => {
  it("an awaiting-vehicle booking holds the bay until its slot end", () => {
    expect(jobHoldsBay({ status: "PENDING_VEHICLE", estimatedEndAt: end }, at("2026-10-19T06:59:00Z"))).toBe(true);
  });
  it("a no-show frees the bay once the slot end has passed", () => {
    expect(jobHoldsBay({ status: "PENDING_VEHICLE", estimatedEndAt: end }, at("2026-10-19T07:00:00Z"))).toBe(false);
    expect(jobHoldsBay({ status: "PENDING_VEHICLE", estimatedEndAt: end }, at("2026-10-19T09:00:00Z"))).toBe(false);
  });
  it("a car that arrived keeps the bay until done, even past the estimate", () => {
    for (const status of ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY"]) expect(jobHoldsBay({ status, estimatedEndAt: end }, at("2026-10-20T09:00:00Z"))).toBe(true);
  });
  it("finished, cancelled and standby jobs never hold a bay", () => {
    for (const status of ["DELIVERED", "CANCELLED", "STANDBY"]) expect(jobHoldsBay({ status, estimatedEndAt: end }, at("2026-10-19T06:00:00Z"))).toBe(false);
  });
});

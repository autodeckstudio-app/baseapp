import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { jobStage, STAGES } from "./job-stage";

describe("live job stages", () => {
  it("maps every in-studio status to one of four plain steps", () => {
    expect(STAGES).toHaveLength(4);
    expect(jobStage("VEHICLE_RECEIVED")?.index).toBe(0);
    expect(jobStage("IN_PROGRESS")?.index).toBe(1);
    expect(jobStage("QUALITY_CHECK")?.index).toBe(2);
    expect(jobStage("READY_FOR_DELIVERY")?.index).toBe(3);
    expect(jobStage("PENDING_VEHICLE")?.index).toBe(-1);
    expect(jobStage("STANDBY")).toBeNull();
    expect(jobStage("CANCELLED")).toBeNull();
  });
  it("copy has no em dashes and no photos on the live job card", () => {
    const src = readFileSync("src/ui/job-stage.ts", "utf8") + readFileSync("src/ui/LiveJobCard.tsx", "utf8");
    expect(src).not.toMatch(/\u2014/);
    expect(src).not.toMatch(/Image|Photo/);
  });
  it("the booking page shows approve with the amount on the button, inside the live card", () => {
    expect(readFileSync("src/ui/LiveJobCard.tsx", "utf8")).toMatch(/Approve \+\$\{rupees\(a\.priceImpact\)\}/);
    expect(readFileSync("src/app/(tabs)/bookings/[id].tsx", "utf8")).toMatch(/respondToApproval\(approvalId, decision\)/);
  });
});

import { readyIsAhead } from "./job-stage";
describe("expected ready", () => {
  it("shows only while it is still ahead", () => {
    const now = Date.parse("2026-10-15T12:00:00+05:30");
    expect(readyIsAhead("2026-10-15", "13:00", now)).toBe(true);
    expect(readyIsAhead("2026-10-09", "12:14", now)).toBe(false);
    expect(readyIsAhead("bad", "x", now)).toBe(false);
  });
});

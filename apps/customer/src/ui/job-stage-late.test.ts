import { describe, it, expect } from "vitest";
import { jobStage } from "./job-stage";
describe("jobStage slot started", () => {
  it("keeps the normal line before the slot", () => expect(jobStage("PENDING_VEHICLE")!.line).toBe("Bring it in at your booked time."));
  it("states the fact once the slot has started, with no instruction", () => {
    const l = jobStage("PENDING_VEHICLE", true)!.line; expect(l).not.toMatch(/Bring it in/); expect(l).toMatch(/has not arrived/);
  });
  it("does not touch started jobs", () => expect(jobStage("IN_PROGRESS", true)!.line).toBe("Your car is being worked on now."));
});

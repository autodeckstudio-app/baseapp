import { describe, expect, it } from "vitest";
import { canMessageJob, cleanJobMessage, JOB_MESSAGE_MAX } from "./types/job-message";
const now = Date.parse("2026-10-16T00:00:00Z");
describe("job chat rules", () => {
  it("open while the car is in the studio", () => { expect(canMessageJob({ status: "IN_PROGRESS" }, now)).toBe(true); expect(canMessageJob({ status: "READY_FOR_DELIVERY" }, now)).toBe(true); });
  it("closed before arrival and when cancelled", () => { expect(canMessageJob({ status: "PENDING_VEHICLE" }, now)).toBe(false); expect(canMessageJob({ status: "CANCELLED" }, now)).toBe(false); expect(canMessageJob({ status: "STANDBY" }, now)).toBe(false); });
  it("stays open 7 days after delivery, then closes", () => {
    expect(canMessageJob({ status: "DELIVERED", sealedAt: "2026-10-12T00:00:00Z" }, now)).toBe(true);
    expect(canMessageJob({ status: "DELIVERED", sealedAt: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(canMessageJob({ status: "DELIVERED" }, now)).toBe(false);
  });
  it("cleans text: trims, collapses blanks, rejects empty and too long", () => {
    expect(cleanJobMessage("  hello \n  there ")).toEqual({ ok: true, text: "hello there" });
    expect(cleanJobMessage("   ").ok).toBe(false);
    expect(cleanJobMessage("x".repeat(JOB_MESSAGE_MAX + 1)).ok).toBe(false);
  });
});

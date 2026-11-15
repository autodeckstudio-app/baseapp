import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// The Help screen must not carry its own policy block (fees, windows, refund time).
// Policy wording is owner-approved copy and lives in one place; a new block needs the owner's exact words first.
describe("Help screen does not publish its own policy block", () => {
  const src = readFileSync(join(__dirname, "../app/(tabs)/help.tsx"), "utf8");
  it("has no cancellation or refund section and no policy constants", () => {
    for (const bad of ["Cancellation and refunds", "REFUND_TIMELINE_TEXT", "cancellationLine", "CANCELLATION_FREE_WINDOW_HOURS", "MAX_CUSTOMER_RESCHEDULES", "working days"]) {
      expect(src).not.toContain(bad);
    }
  });
});

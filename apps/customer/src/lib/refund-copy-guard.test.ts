import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Razorpay's own pages disagree on refund timing, so the app must not publish a number of days.
// Owner-approved wording: "Refund timing depends on your bank or payment provider."
describe("booking refund notice does not publish a refund time range", () => {
  const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/[id].tsx"), "utf8");
  it("uses the approved wording and no day range", () => {
    expect(src).toContain("Refund timing depends on your bank or payment provider.");
    expect(src).not.toContain("5-10");
    expect(src).not.toMatch(/within \d+(-\d+)? (working|business) days/);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Razorpay's own pages disagree on refund timing, so the app must not publish a number of days.
// Owner-approved wording: "Refund timing depends on your bank or payment provider."
describe("booking refund notice does not publish a refund time range", () => {
  const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/[id].tsx"), "utf8");
  it("uses the approved wording and no day range", () => {
    expect(src).toContain("depends on your bank or payment provider.");
    expect(src).not.toContain("5-10");
    expect(src).not.toMatch(/within \d+(-\d+)? (working|business) days/);
  });
});

describe("refund status copy provenance", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "../app/(tabs)/bookings/[id].tsx"), "utf8") as string;
  it("reserved copy does not claim the provider has the refund", () => {
    const line = src.split("\n").find((l: string) => l.includes('refundStatus === "reserved"')) ?? "";
    expect(line).toContain("Your refund request is recorded");
    expect(line).not.toMatch(/queued with the payment provider|on its way|approved/i);
  });
  it("initiated copy stays mechanism-neutral (the initiated writer is also the manual cash/UPI path)", () => {
    expect(src.split("\n").filter((l: string) => l.includes("has accepted your refund"))).toHaveLength(0);
    const line = src.split("\n").find((l: string) => l.includes('refundStatus === "initiated"')) ?? "";
    expect(line).toContain("The studio has recorded your refund");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { MEMBERSHIP_SETTLEMENT_ENABLED } from "./backend-features";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("backend availability gates (studio)", () => {
  it("the flag is enabled because settleMembershipCoveredJob ships with this UI stage", () => {
    expect(MEMBERSHIP_SETTLEMENT_ENABLED).toBe(true);
  });
  it("the settle action remains gated on the flag", () => {
    const job = src("../app/(tabs)/jobs/[id].tsx");
    expect(job).toContain("MEMBERSHIP_SETTLEMENT_ENABLED && booking?.membershipWashUsed");
  });
  it("the record-cash suppression is gated on the same flag", () => {
    const job = src("../app/(tabs)/jobs/[id].tsx");
    expect(job).toContain("!(MEMBERSHIP_SETTLEMENT_ENABLED && (membershipCoveredLabel(job) || (booking && membershipCoveredLabel(booking))))");
  });
});

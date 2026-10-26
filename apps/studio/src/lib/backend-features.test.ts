import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { MEMBERSHIP_SETTLEMENT_ENABLED } from "./backend-features";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("backend availability gates (studio)", () => {
  it("the flag stays false until settleMembershipCoveredJob deploys", () => {
    expect(MEMBERSHIP_SETTLEMENT_ENABLED).toBe(false);
  });
  it("the settle action cannot render while its callable is absent", () => {
    const job = src("../app/(tabs)/jobs/[id].tsx");
    expect(job).toContain("MEMBERSHIP_SETTLEMENT_ENABLED && booking?.membershipWashUsed");
  });
});

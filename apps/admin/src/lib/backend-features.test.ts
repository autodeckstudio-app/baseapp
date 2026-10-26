import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { NO_SHOW_REVIEW_ENABLED, MEMBERSHIP_SETTLEMENT_ENABLED, ACCOUNTANT_MONEY_ENABLED } from "./backend-features";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("backend availability gates (admin)", () => {
  it("flags stay false until their callables deploy", () => {
    expect(NO_SHOW_REVIEW_ENABLED).toBe(false);
    expect(MEMBERSHIP_SETTLEMENT_ENABLED).toBe(false);
    expect(ACCOUNTANT_MONEY_ENABLED).toBe(false);
  });
  it("the no-show review panel cannot render while its callables are absent", () => {
    const panels = src("../components/BookingPanels.tsx");
    expect(panels).toContain("NO_SHOW_REVIEW_ENABLED && booking.status");
    expect(panels.indexOf("NO_SHOW_REVIEW_ENABLED &&")).toBeLessThan(panels.indexOf("<NoShowPanel"));
  });
  it("membership-covered settlement hides while settleMembershipCoveredJob is absent", () => {
    const ms = src("../components/MembershipSettlement.tsx");
    expect(ms).toContain("MEMBERSHIP_SETTLEMENT_ENABLED");
    expect(ms.indexOf("if (!MEMBERSHIP_SETTLEMENT_ENABLED) return null;")).toBeLessThan(ms.indexOf("settleMembershipCoveredJob"));
  });
  it("the accountant money page never calls getAccountantMoney while gated", () => {
    const page = src("../app/(admin)/accountant/page.tsx");
    expect(page).toContain("ACCOUNTANT_MONEY_ENABLED ? await getAccountantMoney");
    expect(page).toContain("This view turns on when its backend is enabled.");
  });
});

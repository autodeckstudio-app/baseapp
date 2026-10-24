import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Source guards: the staff "Needs attention" card shows pending payments flagged for manual check,
// using the existing payments read, a reason-code flag only, and no customer details.
const view = readFileSync(join(__dirname, "DashboardView.tsx"), "utf8");
const page = readFileSync(join(__dirname, "../app/(admin)/dashboard/page.tsx"), "utf8");
describe("dashboard manual-check alert", () => {
  it("is wired from pending payments with a review reason", () => {
    expect(page).toContain('p.status === "pending" && !!p.reviewReason');
    expect(view).toContain("paymentsToReview");
  });
  it("alert text carries a count only, no names or contact details", () => {
    const line = view.split("\n").find((l) => l.includes("paymentsToReview) alerts.push")) ?? "";
    expect(line).toContain("a manual check");
    expect(line).not.toMatch(/customer|phone|email|name/i);
  });
});

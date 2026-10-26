import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// Source guards: manual-check alerts come from the staff-only staffAlerts collection (count only, no customer details),
// never from the customer-readable payment doc, and appear on both the admin card and the studio-path /bookings page.
const read = (p: string) => readFileSync(join(__dirname, p), "utf8");
describe("staff manual-check alert", () => {
  it("dashboard counts staffAlerts, not payment fields", () => {
    const page = read("../app/(admin)/dashboard/page.tsx");
    expect(page).toContain("paymentsToReview: staffAlerts.length");
    expect(page).not.toContain("reviewReason");
  });
  it("studio-visible /bookings page renders the notice", () => {
    expect(read("../app/(admin)/bookings/page.tsx")).toContain("<StaffAlertsNotice />");
  });
  it("service scopes studio role by studioId and exposes no write", () => {
    const svc = read("../lib/staff-alerts-service.ts");
    expect(svc).toContain('where("studioId", "==", scope.studioId)');
    expect(svc).not.toMatch(/setDoc|addDoc|updateDoc|deleteDoc/);
  });
  it("notice text carries a count only", () => {
    const c = read("../components/StaffAlertsNotice.tsx");
    expect(c).not.toMatch(/customerId|phone|email|\.name\b/);
  });
});

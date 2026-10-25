import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("admin refund recovery surface", () => {
  const service = read("lib/refund-work-service.ts");
  const panel = read("experience/OfficeViews.tsx");
  const page = read("app/(admin)/payments/page.tsx");

  it("reads refund work through the admin-only callable and runs the outbox through its own callable", () => {
    expect(service).toContain('"listRefundWork"');
    expect(service).toContain('"processRefundOutbox"');
  });
  it("shows held and ambiguous requests with the provider error and a manual run action", () => {
    expect(panel).toContain("RefundWorkPanel");
    expect(panel).toContain("needs review");
    expect(panel).toContain("held");
    expect(panel).toContain("Run outbox now");
    expect(panel).toContain("lastError");
    expect(panel).toContain("Invoices to review");
    expect(panel).toContain("captured");
    expect(panel).toContain("Sends reserved refunds to the provider");
    expect(panel).toContain("/bookings/");
    expect(page).toContain("held for review");
    expect(panel).not.toContain("—");
  });
  it("surfaces retained legacy claims with a reconciliation-only action, scan progress and accumulation", () => {
    expect(service).toContain('"reconcileRefundClaims"');
    expect(service).toContain("legacyScanComplete");
    expect(panel).toContain("Retained refund claims");
    expect(panel).toContain("Reconcile retained refunds");
    expect(panel).toContain("never submits a new refund");
    expect(panel).toContain("Continue scan");
    expect(panel).toContain("shown so far, more may exist");
    expect(panel).toContain("reconcileNote");
    expect(page).toContain("legacyAccum");
    expect(page).toContain("reconciling");
    expect(page).toContain("handleReconcileClaims");
    expect(page).toContain("held for review");
  });
  it("is mounted on the payments page and refreshes after a run", () => {
    expect(page).toContain("<RefundWorkPanel");
    expect(page).toContain("refreshRefundWork");
  });
});

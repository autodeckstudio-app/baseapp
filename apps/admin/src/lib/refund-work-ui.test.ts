import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("admin refund recovery surface", () => {
  const service = read("lib/refund-work-service.ts");
  const panel = read("experience/OfficeViews.tsx");
  const page = read("app/(admin)/payments/page.tsx");
  const cycle = read("lib/refund-work-cycle.ts");

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
    expect(cycle).toContain("mergeWorkIntoAccum");
    expect(page).toContain("reconciling");
    expect(page).toContain("handleReconcileClaims");
    expect(page).toContain("held for review");
  });
  it("keeps continue-scan list-only, refreshes known rows authoritatively, wires the payment link and truthful counts", () => {
    // continue-scan must not reconcile: it re-lists only
    expect(panel).toContain("onContinueScan");
    expect(page).toContain("onContinueScan={() => void cycle.refresh()}");
    // authoritative per-known-id truth: resolved/released rows disappear, still-held update in place
    expect(service).toContain("claimTruth");
    expect(service).toContain("knownClaimPaymentIds");
    expect(cycle).toContain("work.claimTruth");
    expect(cycle).toContain('t.state === "resolved" || t.state === "released"');
    // identity/tenant change resets the review cycle, and a late response
    // from the previous identity is dropped (generation guard)
    expect(cycle).toContain("accum = new Map()");
    expect(page).toContain("createRefundWorkCycle");
    expect(page).toContain("cycle.reset(!!claims)");
    expect(page).toContain("user?.uid");
    // claim row payment link lands on the filtered record
    expect(page).toContain("useSearchParams");
    expect(page).toContain('searchParams.get("search")');
    // Next 15 production build: useSearchParams under a Suspense boundary
    expect(page).toContain("<Suspense");
    // truthful accounted count includes already-accounted
    expect(page).toContain("already recorded");
  });
  it("is mounted on the payments page and refreshes after a run", () => {
    expect(page).toContain("<RefundWorkPanel");
    expect(page).toContain("cycle.refresh");
  });
  it("binds actions to the identity generation and offers truthful disabled controls where the backend refuses", () => {
    // every post-await effect in both actions is generation-guarded
    expect(page).toContain("cycle.generation()");
    expect(page).toContain("if (cycle.generation() !== gen) return;");
    // unmount disposes the cycle so no late callback lands
    expect(page).toContain("cycle.dispose()");
    // production truth: actions disabled with the activation-pending reason,
    // enabled only where the backend actually executes (emulator/dev)
    expect(service).toContain("refundActionsEnabled");
    expect(service).toContain("failed-precondition");
    expect(panel).toContain("actionsEnabled");
    expect(panel).toContain("Not yet activated in production - held for activation review");
    expect(panel).toContain("!p.actionsEnabled");
  });
});

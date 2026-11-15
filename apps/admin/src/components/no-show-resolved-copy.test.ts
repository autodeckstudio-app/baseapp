// Guard: after a no-show resolution the persistent UI keeps money states
// distinct and grounded in the authoritative refund request - retained charge
// amount, refund amount and the request's real status. Unknown/unavailable
// states get a conservative label, never a success-looking one. The header
// must not contradict the resolution.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./NoShowPanel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/(admin)/bookings/[id]/page.tsx", import.meta.url), "utf8");

describe("resolved no-show copy", () => {
  it("reads the refund amount and status from the refund request, not booking fields", () => {
    expect(panel).toContain("getNoShowResolution");
    expect(panel).toContain("state.refundAmountPaise");
    expect(panel).toContain("state.refundStatus");
  });
  it("maps every refund-request state to distinct truthful staff text", () => {
    for (const key of ["reserved", "submitted", "accepted", "ambiguous", "projected", "failed"]) {
      expect(panel).toContain(`${key}:`);
    }
    expect(panel).toContain("Queued, not yet sent to the payment provider");
    expect(panel).toContain("Unclear at the payment provider - needs a manual check");
    // No label may claim completion: the integration only observes the
    // provider's refund.created (acceptance) event, never terminal settlement.
    const labels = panel.slice(panel.indexOf("REFUND_STATE_LABEL"), panel.indexOf("};", panel.indexOf("REFUND_STATE_LABEL")));
    expect(labels).not.toContain("Completed");
    expect(labels).toContain("recorded in the books");
  });
  it("labels unknown or failed status lookups conservatively", () => {
    expect(panel).toContain("Refund recorded; status unavailable right now.");
    expect(panel).toContain("Checking the refund status...");
  });
  it("header reflects the no-show resolution instead of a bare no-fee line", () => {
    expect(page).toContain("No-show charge");
    expect(page).toContain("kept.");
  });
});

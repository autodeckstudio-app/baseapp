// Guard: after a no-show resolution the persistent UI must keep the money
// states distinct - retained charge, queued-not-sent refund - and the header
// must not contradict the resolution. No provider-completion wording.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./NoShowPanel.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/(admin)/bookings/[id]/page.tsx", import.meta.url), "utf8");

describe("resolved no-show copy", () => {
  it("shows the retained charge and the queued-not-sent refund persistently", () => {
    expect(panel).toContain("Charge kept");
    expect(panel).toContain("Queued, not yet sent to the payment provider");
    expect(panel).toContain("noShowChargePaise");
    expect(panel).toContain("noShowRefundRequestId");
  });
  it("header reflects the no-show resolution instead of a bare no-fee line", () => {
    expect(page).toContain("No-show charge");
    expect(page).toContain("kept.");
    expect(page.indexOf("noShowResolution ?")).toBeLessThan(page.indexOf('"Cancelled. No cancellation fee."'));
  });
});

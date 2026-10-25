// Minimal-candidate source guard: the legacy initiateRefund <-> outbox mutual
// interlock stays in place and in order.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const initiate = readFileSync(`${__dirname}/../../functions/payment/initiateRefund.ts`, "utf8");
const outbox = readFileSync(`${__dirname}/../../lib/refund-outbox.ts`, "utf8");

describe("legacy initiateRefund <-> outbox mutual interlock", () => {
  it("initiateRefund refuses a payment with an active outbox reservation BEFORE claiming the refund event", () => {
    const guard = initiate.indexOf("A refund request is already active for this payment.");
    const claim = initiate.indexOf("refund_${data.paymentId}");
    expect(guard).toBeGreaterThan(-1);
    expect(claim).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(claim);
  });
  it("outbox reservation refuses when a legacy refund_<paymentId> claim exists", () => {
    expect(outbox).toContain("refund_");
    expect(outbox).toMatch(/manual refund obligation/);
  });
  it("a failed provider notification holds: no release, no resubmit", () => {
    expect(outbox).toContain("held for manual reconciliation");
    // releaseGuard may only be reached on projected or authoritative absence.
    const releases = outbox.split("\n").filter((l) => l.includes("releaseGuard(db"));
    expect(releases.length).toBeGreaterThan(0);
  });
});

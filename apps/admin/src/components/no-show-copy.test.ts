// Guard: no-show review copy is plain staff-facing wording. No internal
// approval-process narration ("Owner-delegated", "not settled") and no em
// dashes in user-visible strings (brand rule: no em dashes).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./NoShowPanel.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../../../../functions/src/functions/booking/noShowReview.ts", import.meta.url), "utf8");

describe("no-show copy", () => {
  it("keeps the explicit choice without narrating the approval process", () => {
    expect(panel).not.toMatch(/Owner-delegated|not settled|Studio no-show policy/);
    expect(server).not.toMatch(/Owner-delegated|not settled|Studio no-show policy/);
    // The choice itself must stay: both charge options and the waiver.
    expect(panel).toMatch(/Charge Rs 100/);
    expect(panel).toMatch(/Charge 20%/);
    expect(panel).toMatch(/Waive the charge/);
  });
  it("uses no em dashes in user-visible copy", () => {
    expect(panel).not.toMatch(/—/);
    const policyNote = server.match(/policyNote: "([^"]+)"/);
    expect(policyNote?.[1] ?? "").not.toMatch(/—/);
  });
});

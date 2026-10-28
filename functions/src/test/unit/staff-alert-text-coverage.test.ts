// Guardrail (28 Oct): every waiting-cancel staff alert kind the backend writes must have staff-facing text, and the
// needs_review panel text must not claim the payment link is closed (the booking doc does not carry that fact).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("waiting-cancel alert text coverage", () => {
  const lib = read("functions/src/lib/waiting-cancel.ts");
  const kinds = [...lib.matchAll(/alert\(\w+, "([a-z_]+)"/g)].map((m) => m[1]!);
  const notice = read("apps/admin/src/components/StaffAlertsNotice.tsx");
  it("finds the alert kinds", () => { expect(kinds.length).toBeGreaterThanOrEqual(3); });
  for (const k of new Set(kinds)) it(`StaffAlertsNotice has text for ${k}`, () => { expect(notice).toMatch(new RegExp(`\\n\\s+${k}:\\s*\\(n\\)`)); });
  it("needs_review panel text never claims the link is closed", () => {
    const panel = read("apps/admin/src/components/CancelBookingPanel.tsx");
    const line = panel.split("\n").find((l) => l.includes('cancelIntent.state === "needs_review" ?'))!;
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/link is closed|closed link/i);
    expect(line).toMatch(/may still be in progress or arrive/);
  });
});

describe("late-membership alert text coverage", () => {
  const hook = readFileSync(resolve(__dirname, "../../lib/razorpay-webhook.ts"), "utf8");
  const notice = readFileSync(resolve(__dirname, "../../../../apps/admin/src/components/StaffAlertsNotice.tsx"), "utf8");
  const kinds = [...new Set([...hook.matchAll(/"(late_membership_[a-z_]+)"/g)].map((m) => m[1]!))];
  it("the webhook writes the late-membership alert kinds", () => { expect(kinds.sort()).toEqual(["late_membership_already_reserved", "late_membership_payment", "late_membership_refund_not_reserved"]); });
  for (const k of kinds) it(`StaffAlertsNotice has text for ${k}`, () => { expect(notice).toMatch(new RegExp(`\\n\\s+${k}:\\s*\\(n\\)`)); });
});

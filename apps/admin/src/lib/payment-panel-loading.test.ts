// TEST (guardrail). The Payment panel must not say "No payment started yet" before the payment listener has answered
// (live incident 24 Oct: the panel showed it for the first moments while the payment was Refunded).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const pages: ReadonlyArray<readonly [string, string]> = [
  // The jobs payment panel lives in the JobPaymentPanel component; the loading-state
  // useState stays in the page. Guard both together.
  ["jobs", readFileSync(join(__dirname, "../app/(admin)/jobs/[id]/page.tsx"), "utf8") + readFileSync(join(__dirname, "../components/JobPaymentPanel.tsx"), "utf8")],
  ["bookings", readFileSync(join(__dirname, "../app/(admin)/bookings/[id]/page.tsx"), "utf8")],
];
describe("payment panel loading state", () => {
  for (const [name, src] of pages) {
    it(`${name} page: payment starts undefined and shows Loading before any "No payment" text`, () => {
      expect(src).toContain("useState<Payment | null | undefined>(undefined)");
      expect(src.includes("payment === undefined") || src.includes("paymentPanelMode(payment)")).toBe(true);
      expect(src.indexOf("Loading payment")).toBeLessThan(src.indexOf("No payment started yet"));
    });
  }
  it("the job page never offers a payment link or counter payment while the payment is still loading", () => {
    const src = pages[0]![1];
    expect(src).toContain("canOfferPayment(payment, job.paymentStatus).link");
    expect(src).toContain("canOfferPayment(payment, job.paymentStatus).counter");
  });
});

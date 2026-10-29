import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { cancellationPolicySummary, cancellationLine } from "@autodeck/core";

const r = (f: string) => readFileSync(new URL(f, import.meta.url).pathname, "utf8");

describe("cancel bands come from one source", () => {
  it("the summary states both bands", () => {
    const t = cancellationPolicySummary();
    for (const x of ["4 hours", "Rs 100", "24 hours", "20%"]) expect(t).toContain(x);
    expect(cancellationLine("washing")).toContain("4 hours");
    expect(cancellationLine("ceramic")).toContain("24 hours");
  });
  it("app FAQs retain the core summary while the public site uses approved contact-first terms", () => {
    for (const f of ["./studio-info.ts", "./showcase.ts"]) expect(r(f)).toContain("cancellationPolicySummary()");
    const approved = "For cancellation, refund, pickup, warranty or membership terms, please contact AutoDeck before confirming your booking.";
    for (const page of ["terms", "faq"]) {
      expect(r(`../../../site/src/pages/${page}.astro`)).toContain(`../data/redesign/${page}.html?raw`);
      const content = r(`../../../site/src/data/redesign/${page}.html`);
      expect(content).toContain(approved);
      expect(content).not.toContain(cancellationPolicySummary());
      expect(content).not.toMatch(/conditions shown for your booking before confirming|Your booking shows the final terms/i);
    }
  });
});

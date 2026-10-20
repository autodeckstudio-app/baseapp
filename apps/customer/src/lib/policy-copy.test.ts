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
  it("app FAQs use the core summary, and the site FAQ and Terms say the same words", () => {
    for (const f of ["./studio-info.ts", "./showcase.ts"]) expect(r(f)).toContain("cancellationPolicySummary()");
    expect(r("../../../site/src/pages/terms.astro")).toContain(cancellationPolicySummary());
    expect(r("../../../site/src/pages/faq.astro")).toContain(cancellationPolicySummary());
  });
});

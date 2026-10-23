import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Peer-confirmed contract: only PPF is priced by car size. The size-rule editor shows for Paint film only;
// saved rules on other categories stay in the draft (not deleted) so saving does not drop them.
describe("admin services size rules are PPF-only", () => {
  const src = readFileSync(new URL("./ServicesView.tsx", import.meta.url), "utf8");
  it("size-rule editor is gated on the ppf category", () => {
    const gate = src.indexOf('draft.category === "ppf" ? (');
    const note = src.indexOf("Bigger cars can cost more");
    const add = src.indexOf("Add a size rule");
    expect(gate).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(gate);
    expect(add).toBeGreaterThan(note);
  });
  it("non-PPF shows the flat-price note and never clears stored rules", () => {
    expect(src).toContain("Only paint film is priced by car size.");
    expect(src).toContain("kept, not shown, and not used for pricing");
    expect(src).not.toMatch(/category[^\n]*sizes:\s*\[\]/);
  });
});

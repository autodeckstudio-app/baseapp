import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// Bug found by the owner 18 Oct: invoice and PDF buttons sat tight under the last visit, and gaps between sections looked uneven.
describe("car detail timeline spacing", () => {
  const tl = readFileSync(`${__dirname}/../ui/CareTimeline.tsx`, "utf8");
  const page = readFileSync(`${__dirname}/../app/(tabs)/garage/[id].tsx`, "utf8");
  it("extras (small invoice link) sit just under the row, in the text column", () => expect(tl).toContain("<View style={{ marginTop: 2 }}>{renderExtra(it)}</View>"));
  it("the history block separates the timeline from the PDF button by the standard gap", () => {
    expect(page).toMatch(/<View style=\{\{ gap: space\.gap \}\}>\s*<CareTimeline\s+title="Service history"/);
  });
  it("the rail column keeps its fixed width and extras no longer pull back left", () => {
    expect(tl).toContain("const RAIL = 12;");
    expect(tl).not.toContain("marginLeft: -(RAIL + space.inset)");
    expect(tl).toContain("width: RAIL");
  });
});

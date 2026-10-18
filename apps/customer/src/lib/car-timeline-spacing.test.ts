import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// Bug found by the owner 18 Oct: invoice and PDF buttons sat tight under the last visit, and gaps between sections looked uneven.
describe("car detail timeline spacing", () => {
  const tl = readFileSync(`${__dirname}/../ui/CareTimeline.tsx`, "utf8");
  const page = readFileSync(`${__dirname}/../app/(tabs)/garage/[id].tsx`, "utf8");
  it("extras (invoice link) sit one line gap under the row", () => expect(tl).toContain("marginTop: space.line"));
  it("the history block separates the timeline from the PDF button by the standard gap", () => {
    expect(page).toMatch(/<View style=\{\{ gap: space\.gap \}\}>\s*<CareTimeline\s+title="Service history"/);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// iOS Safari zooms the page when a focused field's font is under 16px and does not zoom back.
// These are the text-field sources for Studio and Admin on web; pinch zoom itself must stay allowed.
const root = `${__dirname}/../../../..`;
const read = (p: string) => readFileSync(`${root}/${p}`, "utf8");
describe("web text fields are 16px or larger", () => {
  it("shared TextInput and SearchInput", () => {
    for (const f of ["packages/ui/src/components/TextInput.tsx", "packages/ui/src/components/SearchInput.tsx"]) expect(read(f)).toMatch(/Math\.max\(16, typography\.body\.fontSize\)/);
  });
  it("Studio agreed-time field", () => expect(read("apps/studio/src/components/AgreedTimeInput.tsx")).toMatch(/fontSize: 16,/));
  it("Studio page-level phone rule covers raw inputs that use the 14px body style", () => {
    expect(read("apps/studio/public/index.html")).toMatch(/@media \(max-width: 820px\)[\s\S]*textarea[\s\S]*font-size: 16px !important/);
  });
  it("Admin phone rule, with no viewport lock", () => {
    expect(read("apps/admin/src/app/globals.css")).toMatch(/@media \(max-width: 820px\)[\s\S]*font-size: 16px !important/);
    expect(read("apps/admin/src/app/layout.tsx")).not.toMatch(/maximum-scale|userScalable|user-scalable/);
    expect(read("apps/studio/public/index.html")).not.toMatch(/maximum-scale|user-scalable/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("car detail layout", () => {
  it("tab pills never wrap and car detail uses the approved 3-tab layout", () => {
    const o = read("ui/CarOverview.tsx");
    expect(o).toContain('flexWrap: "nowrap"');
    expect(o).not.toContain('flexWrap: "wrap", gap: 10');
    // Approved redesign (mockup 00-tabs-final; Gauri "looks nice" 2 Nov 14:44; Meet accept 16:25):
    // Upcoming / History / Documents, nothing repeated between tabs.
    const g = read("app/(tabs)/garage/[id].tsx");
    expect(g).toContain("TabPills");
    expect(g).toContain('key: "upcoming"');
    expect(g).toContain('key: "history"');
    expect(g).toContain('key: "documents"');
  });
  it("hero facts are one slim line, and the details card does not repeat make, model or plate", () => {
    const h = read("ui/CarHero.tsx");
    expect(h).toContain('numberOfLines={1}');
    expect(h).not.toContain("flexBasis");
    const g = read("app/(tabs)/garage/[id].tsx");
    expect(g).not.toContain('{ label: "Make"');
    expect(g).not.toContain('{ label: "Registration"');
  });
});

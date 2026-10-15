import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("car detail layout", () => {
  it("tabs never wrap and the history tab is named History", () => {
    const o = read("ui/CarOverview.tsx");
    expect(o).toContain('flexWrap: "nowrap"');
    expect(o).not.toContain('flexWrap: "wrap", gap: 10');
    const g = read("app/(tabs)/garage/[id].tsx");
    expect(g).toContain('label: "History"');
    expect(g).not.toContain('label: "Service history"');
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

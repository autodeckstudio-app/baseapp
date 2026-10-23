import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
describe("round7 points 1-2", () => {
  it("point 1: dropdown options carry explicit theme colours (dark list is dark with light text)", async () => {
    const src = read("src/ui/inputs.tsx");
    expect(src).toContain("optionStyleFor(day)");
    expect(src.match(/style:optStyle/g)?.length).toBe(2);
    expect(src).toContain("background: day ? '#FFFFFF' : '#1D1B26', color: day ? '#1D1B26' : '#F6F4F1'");
  });
  it("point 2: a trailing pill is pinned outside the horizontal scroller, and no trailing means the same scroller as before", () => {
    const src = read("src/ui/FilterPills.tsx");
    expect(src).toContain("trailing && !pinned ? trailing : null");
    expect(src).toContain("if (!pinned || !trailing) return row;");
    expect(src).toContain("flex: 1, minWidth: 0");
  });
});

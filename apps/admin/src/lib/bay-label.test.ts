import { describe, it, expect } from "vitest";
import { bayLabel, bayChip } from "./bay-label";

const bays = [{ id: "bTJLQvWpQq8l68iwijOy", name: "General Bay 1" }];
describe("bayLabel", () => {
  it("uses the studio bay name for a generated id", () => expect(bayLabel("bTJLQvWpQq8l68iwijOy", bays)).toBe("General Bay 1"));
  it("keeps the short form for legacy bay-ids", () => expect(bayLabel("bay-wash-1", [])).toBe("wash-1"));
  it("never shows an unknown raw id", () => expect(bayLabel("zzRawGeneratedId99", bays)).toBeUndefined());
  it("returns nothing for no bay", () => expect(bayLabel(undefined, bays)).toBeUndefined());
  it("does not double the word Bay", () => { expect(bayChip("General Bay 1")).toBe("General Bay 1"); expect(bayChip("wash-1")).toBe("Bay wash-1"); });
});

import { readFileSync } from "node:fs";
describe("jobs page never prints a raw bay id", () => {
  it("list view cells use bayLabel", () => {
    const s = readFileSync(`${__dirname}/../app/(admin)/jobs/page.tsx`, "utf8");
    expect(s).not.toMatch(/<td>\{j\.bayId\}<\/td>/);
    expect(s).toContain("bayLabel(j.bayId, bays)");
  });
});

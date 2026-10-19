import { describe, expect, it } from "vitest";
import type { StoryView } from "@autodeck/core";
import { groupStories } from "./story-groups";

const now = Date.parse("2026-10-12T00:00:00Z");
const S = (id: string, daysAgo: number, title: string | null): StoryView => ({ id, mediaType: "image", url: `u${id}`, caption: null, pinned: title !== null, highlightTitle: title, hidden: false, createdAt: new Date(now - daysAgo * 864e5).toISOString(), expiresAt: new Date(now - daysAgo * 864e5 + 864e5).toISOString() });

describe("groupStories", () => {
  it("makes one circle per collection, newest first, after Today", () => {
    const g = groupStories([S("1", 0.1, null), S("2", 5, "Coatings"), S("3", 6, "Coatings"), S("4", 3, "Detailing"), { ...S("5", 9, "x"), highlightTitle: null }], now);
    expect(g.map((x) => x.title)).toEqual(["Today", "Detailing", "Coatings", "Highlights"]);
    expect(g.find((x) => x.title === "Coatings")!.items.map((s) => s.id)).toEqual(["3", "2"]);
  });
});

import { readFileSync } from "node:fs";
describe("story circles never hide a group for lacking a photo", () => {
  it("StoryCircles shows an initial instead of filtering on cover", () => {
    const s = readFileSync(`${__dirname}/../ui/StoryCircles.tsx`, "utf8");
    expect(s).not.toMatch(/filter\(\(g\) => g\.cover\)/);
    expect(s).toContain("toUpperCase()");
  });
});

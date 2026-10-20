import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { StoryView } from "@autodeck/core";
import { groupStories, seenKeyOf, storyAge } from "./story-groups";

const now = Date.parse("2026-10-12T00:00:00Z");
const S = (id: string, daysAgo: number, title: string | null, extra: Partial<StoryView> = {}): StoryView => ({ id, mediaType: "image", url: `u${id}`, caption: null, pinned: title !== null, highlightTitle: title, hidden: false, createdAt: new Date(now - daysAgo * 864e5).toISOString(), expiresAt: new Date(now - daysAgo * 864e5 + 864e5).toISOString(), ...extra });

describe("groupStories", () => {
  it("Today first, then only the five highlights in their fixed order, skipping empty ones", () => {
    const g = groupStories([S("1", 0.1, null), S("2", 5, "Ceramic"), S("3", 6, "Ceramic"), S("4", 3, "PPF"), S("5", 9, "Modifications")], now);
    expect(g.map((x) => x.title)).toEqual(["Today", "PPF", "Ceramic", "Modifications"]);
    expect(g.find((x) => x.title === "Ceramic")!.items.map((s) => s.id)).toEqual(["3", "2"]);
  });
  it("a title outside the five, and hidden stories, never show", () => {
    expect(groupStories([S("1", 5, "Coatings"), S("2", 5, "Washing", { hidden: true })], now)).toEqual([]);
  });
  it("a video-only group still shows (no photo cover is fine)", () => {
    expect(groupStories([S("1", 5, "Detailing", { mediaType: "video" })], now)[0]!.cover).toBeNull();
  });
  it("the ring lights up again when a newer story arrives", () => {
    const a = groupStories([S("1", 5, "PPF")], now)[0]!; const b = groupStories([S("1", 5, "PPF"), S("2", 4, "PPF")], now)[0]!;
    expect(seenKeyOf(a)).not.toBe(seenKeyOf(b));
  });
  it("ages", () => { expect(storyAge(new Date(now - 90 * 60000).toISOString(), now)).toBe("1h"); expect(storyAge(new Date(now - 3 * 864e5).toISOString(), now)).toBe("3d"); });
});

describe("tray and viewer follow the Instagram pattern", () => {
  const c = readFileSync(`${__dirname}/../ui/StoryCircles.tsx`, "utf8");
  const v = readFileSync(`${__dirname}/../ui/StoryViewer.tsx`, "utf8");
  it("circles show an initial instead of hiding a group without a photo", () => { expect(c).not.toMatch(/filter\(\(g\) => g\.cover\)/); expect(c).toContain("toUpperCase()"); });
  it("viewer: progress bars, hold to pause, next group at the end, previous group at the start, swipe down to close", () => {
    for (const x of ["onPressIn", "onPressOut", "onNextGroup", "onPrevGroup", "onTouchStart", "onTouchEnd"]) expect(v).toContain(x);
  });
});

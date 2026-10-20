import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { swipeTarget } from "./segment-swipe-core";

const keys = ["active", "upcoming", "past"] as const;

describe("swipeable booking tabs", () => {
  it("swipe left goes to the next tab, right to the previous", () => {
    expect(swipeTarget(keys, "active", -120, 5)).toBe("upcoming");
    expect(swipeTarget(keys, "upcoming", -120, 5)).toBe("past");
    expect(swipeTarget(keys, "past", 120, 5)).toBe("upcoming");
    expect(swipeTarget(keys, "upcoming", 120, 5)).toBe("active");
  });
  it("does nothing at either end", () => {
    expect(swipeTarget(keys, "past", -150, 0)).toBeNull();
    expect(swipeTarget(keys, "active", 150, 0)).toBeNull();
  });
  it("ignores short drags and mostly vertical scrolling", () => {
    expect(swipeTarget(keys, "active", -20, 0)).toBeNull();
    expect(swipeTarget(keys, "active", -100, 90)).toBeNull();
  });
  it("the Bookings screen wires the swipe to the same state the tab taps use", () => {
    const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/index.tsx"), "utf8");
    expect(src).toContain("useSegmentSwipe(");
    expect(src).toContain("setSegPick");
    expect(src).toMatch(/<TabPills[^>]*onChange=\{setSegPick\}/);
  });
  it("the swipe hook is called before the loading early return (hooks order crash seen live on 20 Oct)", () => {
    const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/index.tsx"), "utf8");
    const hookAt = src.indexOf("useSegmentSwipe(");
    const earlyAt = src.indexOf("return <Loading");
    expect(hookAt).toBeGreaterThan(0);
    expect(earlyAt).toBeGreaterThan(0);
    expect(hookAt).toBeLessThan(earlyAt);
  });
  it("every tab can be swiped to its neighbours, whatever the list holds", () => {
    const next: Record<string, string | null> = { active: "upcoming", upcoming: "past", past: null };
    const prev: Record<string, string | null> = { active: null, upcoming: "active", past: "upcoming" };
    for (const k of keys) {
      expect(swipeTarget(keys, k, -140, 4)).toBe(next[k]);
      expect(swipeTarget(keys, k, 140, 4)).toBe(prev[k]);
    }
  });
  it("the swipe area fills the screen height so an empty tab is swipeable too (Meet, 20 Oct)", () => {
    const src = readFileSync(join(__dirname, "../app/(tabs)/bookings/index.tsx"), "utf8");
    expect(src).toMatch(/\{\.\.\.swipe\.handlers\} style=\{\[\{[^}]*minHeight: Math\.max\(winH/);
    expect(src.indexOf("useWindowDimensions()")).toBeLessThan(src.indexOf("return <Loading"));
    // the wrapper encloses all three panes and the empty notices
    const open = src.indexOf("{...swipe.handlers}");
    for (const marker of ["No past visits", "tab === \"active\"|seg === \"active\"", "seg === \"upcoming\""]) {
      const m = src.search(new RegExp(marker));
      expect(m, marker).toBeGreaterThan(open);
    }
  });
});

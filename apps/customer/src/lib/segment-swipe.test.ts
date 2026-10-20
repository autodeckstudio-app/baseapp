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
});

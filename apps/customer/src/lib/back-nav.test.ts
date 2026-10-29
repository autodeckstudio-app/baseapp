import { describe, it, expect } from "vitest";
import { backFallback, collapseStaleBookEntries } from "./back-nav";

describe("back navigation coverage", () => {
  it("shows no Back on tab roots", () => {
    for (const s of [["(tabs)"], ["(tabs)", "index"], ["(tabs)", "bookings"], ["(tabs)", "bookings", "index"], ["(tabs)", "garage"], ["(tabs)", "profile"], ["(tabs)", "catalogue"]]) expect(backFallback(s)).toBeNull();
  });
  it("shows Back on drill-downs and secondary roots, including gifts", () => {
    expect(backFallback(["(tabs)", "garage", "[id]"])).toBe("/(tabs)/garage");
    expect(backFallback(["(tabs)", "bookings", "[id]"])).toBe("/(tabs)/bookings");
    expect(backFallback(["(tabs)", "invoice", "[number]"])).toBe("/(tabs)/bookings");
    expect(backFallback(["(tabs)", "book", "[serviceId]"])).toBe("/(tabs)/catalogue");
    expect(backFallback(["(tabs)", "book", "confirm"])).toBe("/(tabs)/catalogue");
    expect(backFallback(["(tabs)", "approvals", "[id]"])).toBe("/(tabs)/bookings");
    expect(backFallback(["(tabs)", "membership"])).toBe("/(tabs)/profile");
    expect(backFallback(["(tabs)", "gifts"])).toBe("/(tabs)");
    expect(backFallback(["(tabs)", "help"])).toBe("/(tabs)");
  });
  it("shows Back on top-level sell, services and shop", () => {
    expect(backFallback(["sell"])).toBe("/(tabs)/cars");
    expect(backFallback(["services"])).toBe("/(tabs)/catalogue");
    expect(backFallback(["shop"])).toBe("/(tabs)");
    expect(backFallback(["preview"])).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
describe("garage history Back to garage", () => {
  it("returns to the previous page instead of pushing a new garage entry", () => {
    const s = readFileSync(join(__dirname, "../app/(tabs)/garage/history.tsx"), "utf8");
    expect(s).toContain('router.canGoBack() ? router.back() : router.replace("/(tabs)/garage")');
    expect(s).not.toContain('router.push("/(tabs)/garage")');
  });
});

describe("cold-load fallbacks point at routes that exist", () => {
  it("every fallback target has an index screen or is a tab root", () => {
    const base = join(__dirname, "../app/(tabs)");
    const { existsSync } = require("node:fs");
    for (const segs of [["(tabs)", "book", "[serviceId]"], ["(tabs)", "approvals", "[id]"], ["(tabs)", "invoice", "[number]"], ["(tabs)", "garage", "[id]"], ["(tabs)", "bookings", "[id]"], ["(tabs)", "membership", "current"], ["(tabs)", "catalogue", "[id]"], ["(tabs)", "gifts"], ["(tabs)", "notifications"], ["(tabs)", "cars", "[id]"]]) {
      const t = backFallback(segs)!.replace("/(tabs)/", "").replace("/(tabs)", "");
      const ok = t === "" || existsSync(join(base, t, "index.tsx")) || existsSync(join(base, `${t}.tsx`));
      expect(ok, `${segs.join("/")} -> ${t}`).toBe(true);
    }
  });
});

describe("tab navigator history", () => {
  it("Tabs uses backBehavior=history so Back returns to the page the user came from, not the first tab", () => {
    const s = readFileSync(join(__dirname, "../app/(tabs)/_layout.tsx"), "utf8");
    expect(s).toMatch(/<Tabs backBehavior="history"/);
  });
});

describe("stale Book entries", () => {
  const r = (name: string, key: string) => ({ name, key });
  it("keeps only the new page when it opens over an older Book page (Ceramic over Full detail wash)", () => {
    const out = collapseStaleBookEntries({ index: 1, routes: [r("[serviceId]", "full"), r("[serviceId]", "ceramic")] });
    expect(out).toEqual({ index: 0, routes: [r("[serviceId]", "ceramic")] });
  });
  it("also drops an older Confirm left under a new Book page", () => {
    const out = collapseStaleBookEntries({ index: 2, routes: [r("[serviceId]", "a"), r("confirm", "c"), r("[serviceId]", "b")] });
    expect(out?.routes).toEqual([r("[serviceId]", "b")]);
  });
  it("does nothing for a clean stack, for Confirm on top, or for a missing state", () => {
    expect(collapseStaleBookEntries({ index: 0, routes: [r("[serviceId]", "a")] })).toBeNull();
    expect(collapseStaleBookEntries({ index: 1, routes: [r("[serviceId]", "a"), r("confirm", "c")] })).toBeNull();
    expect(collapseStaleBookEntries(undefined)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { backFallback } from "./back-nav";

describe("back navigation coverage", () => {
  it("shows no Back on tab roots", () => {
    for (const s of [["(tabs)"], ["(tabs)", "index"], ["(tabs)", "bookings"], ["(tabs)", "bookings", "index"], ["(tabs)", "garage"], ["(tabs)", "profile"], ["(tabs)", "catalogue"]]) expect(backFallback(s)).toBeNull();
  });
  it("shows Back on drill-downs and secondary roots, including gifts", () => {
    expect(backFallback(["(tabs)", "garage", "[id]"])).toBe("/(tabs)/garage");
    expect(backFallback(["(tabs)", "bookings", "[id]"])).toBe("/(tabs)/bookings");
    expect(backFallback(["(tabs)", "invoice", "[number]"])).toBe("/(tabs)/invoice");
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

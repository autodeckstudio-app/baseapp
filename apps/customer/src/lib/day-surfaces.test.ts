import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(`${__dirname}/../${f}`, "utf8");

describe("Day surfaces are never the night colour", () => {
  it("the light card recipe is warm off-white", () => {
    const r = read("lib/raised.ts");
    expect(r).toContain('surface: "#FBF8F3"');
    expect(r).toMatch(/const surf = night \? "#1B1B1F" : c\.surface/);
  });
  it("glassPane has a light variant that is the warm card, not dark glass", () => {
    const g = read("lib/glass-pane.ts");
    const light = g.slice(g.indexOf("if (light)"), g.indexOf("if (Platform.OS !== \"web\")"));
    expect(light).toContain('"#FBF8F3"');
    expect(light).not.toMatch(/rgba\((24|28),/);
  });
  it("Home never calls glassPane without the mode", () => {
    expect(read("ui/HomeView.tsx")).not.toMatch(/glassPane\(\)/);
  });
  it("components that draw a night card colour also branch on the theme", () => {
    for (const f of ["ui/GarageCard.tsx", "app/(tabs)/catalogue/[id].tsx", "ui/SlideToConfirm.tsx"]) {
      expect(read(f)).toMatch(/"light"/);
    }
  });
});

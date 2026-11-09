import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(`${__dirname}/../${f}`, "utf8");

describe("Day surfaces are never the night colour", () => {
  it("the light card recipe is warm off-white", () => {
    const r = read("lib/raised.ts");
    expect(r).toContain('surface: "#FFFFFF"');
    expect(r).toContain('canvas: "#FFFFFF"');
    expect(r).toContain('material(mode,"surface")');
  });
  it("glassPane has a light variant that is the warm card, not dark glass", () => {
    const g = read("lib/glass-pane.ts");
    const light = g.slice(g.indexOf("if (light)"), g.indexOf("if (Platform.OS !== \"web\")"));
    expect(light).toMatch(/"#FFFFFF"|rgba\(255,255,255,0\.[5-9]/);
    expect(light).not.toMatch(/rgba\((24|28|34|40),/);
  });
  it("Home never calls glassPane without the mode", () => {
    expect(read("ui/HomeView.tsx")).not.toMatch(/glassPane\(\)/);
  });
  it("service detail delegates its inline action surface to the theme-aware Pane",()=>{const s=read("app/(tabs)/catalogue/[id].tsx");expect(s).toContain('nextAction={focused&&showBar?');expect(s).not.toContain('<ServiceActionBar');expect(s).not.toContain('backgroundColor: mode ===');});
  it("components that draw a night card colour also branch on the theme", () => {
    for (const f of ["ui/GarageCard.tsx", "ui/SlideToConfirm.tsx"]) {
      expect(read(f)).toMatch(/"light"/);
    }
  });
});

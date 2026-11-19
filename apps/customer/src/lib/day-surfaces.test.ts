import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string) => readFileSync(`${__dirname}/../${f}`, "utf8");

describe("Day surfaces are never the night colour", () => {
  it('approved pale card and ground stay in the light colour family',()=>{expect(read('lib/customer-glacier.ts')).toContain("canvas:'#ffffff'");expect(read('lib/customer-glacier.ts')).toContain("surface:'#f7f9fb'");expect(read('lib/raised.ts')).toContain('backgroundColor: c.surface')});
  it("glassPane delegates to the customer mode-aware material",()=>{
    expect(read("lib/glass-pane.ts")).toContain("raised(light?'light':'night').card");
    expect(read("lib/raised.ts")).toContain("backgroundColor: c.surface");
  });
  it("Home never calls glassPane without the mode", () => {
    expect(read("ui/HomeView.tsx")).not.toMatch(/glassPane\(\)/);
  });
  it("service detail uses the theme-aware labelled booking action, not an action on duration",()=>{const s=read("app/(tabs)/catalogue/[id].tsx");expect(s).toContain('{focused&&showBar?<Button style=');expect(s).not.toContain('<ServiceVisitFacts nextAction=');expect(s).not.toContain('<ServiceActionBar');expect(s).not.toContain('backgroundColor: mode ===');});
  it("components that draw a night card colour also branch on the theme", () => {
    for (const f of ["ui/GarageCard.tsx", "ui/SlideToConfirm.tsx"]) {
      expect(read(f)).toMatch(/"light"/);
    }
  });
});

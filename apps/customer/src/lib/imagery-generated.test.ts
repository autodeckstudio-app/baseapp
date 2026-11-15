import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");
const src = readFileSync(join(__dirname, "imagery.ts"), "utf8");
const files = ["pickup", "coating", "garage-ac", "garage-battery", "garage-inspection", "garage-alignment", "garage-repairs", "mods-tint", "mods-wrap", "mods-accessories"];

describe("approved generated service imagery", () => {
  it("ships every approved image file", () => {
    for (const f of files) expect(existsSync(join(root, "assets/imagery/generated", `${f}.jpg`)), f).toBe(true);
  });
  it("Pickup and Coating categories use their own photo, not the generic fallback or the ceramic photo", () => {
    expect(src).toMatch(/pickup: genPickup/);
    expect(src).toMatch(/coating: genCoating/);
    expect(src).not.toMatch(/pickup: serviceOther/);
  });
  it("garage and modification service topics resolve to the generated photos", () => {
    for (const f of files.filter((x) => x.startsWith("garage") || x.startsWith("mods"))) expect(src, f).toContain(`generated/${f}.jpg`);
  });
});

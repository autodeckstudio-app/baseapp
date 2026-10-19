import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

const root = `${__dirname}/../..`;
const NAMES = ["paint-protection", "ceramic-coating", "detailing", "wash-and-care", "garage", "modifications"];
describe("approved category photographs", () => {
  it("exist in the app and on the site under neutral names", () => {
    for (const n of NAMES) {
      expect(existsSync(`${root}/assets/imagery/category/${n}.jpg`)).toBe(true);
      expect(existsSync(`${root}/../site/public/assets/img/service-${n}.jpg`)).toBe(true);
    }
  });
  it("each category uses its own photo, and tinting and inspection are not given a photo of another service", () => {
    const s = readFileSync(`${root}/src/lib/imagery.ts`, "utf8");
    for (const [cat, img] of [["washing", "catWash"], ["ceramic", "catCeramic"], ["coating", "catCeramic"], ["ppf", "catPpf"], ["garage", "catGarage"], ["modifications", "catMods"]]) expect(s).toContain(`${cat}: ${img},`);
    expect(s).toContain("tinting: serviceTinting,");
    expect(s).toContain("inspection: serviceInspection,");
    expect(s).toContain('if (key === "complete") return detailingImage;');
  });
});

import { readdirSync, statSync } from "node:fs";
describe("a car is shown with its own photo or a neutral icon, never a stock car", () => {
  it("no screen outside the preview pages uses the stock vehicleImagery", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
    const offenders = walk(`${root}/src`).filter((p) => !/preview|imagery\.ts|\.test\./.test(p)).filter((p) => readFileSync(p, "utf8").includes("vehicleImagery"));
    expect(offenders).toEqual([]);
  });
});

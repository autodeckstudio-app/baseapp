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
    for (const [cat, img] of [["washing", "catWash"], ["ceramic", "catCeramic"], ["coating", "genCoating"], ["ppf", "catPpf"], ["garage", "catGarage"], ["modifications", "catMods"]]) expect(s).toContain(`${cat}: ${img},`);
    expect(s).toContain("tinting: serviceTinting,");
    expect(s).toContain("inspection: serviceInspection,");
    expect(s).toContain('if (key === "complete") return detailingImage;');
  });
});

import { readdirSync, statSync } from "node:fs";
describe("a car is shown with its own photo or a neutral icon, never a stock car", () => {
  it("no screen outside the preview pages uses the stock vehicleImagery", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []; });
    // Owner decision (Nov 7, 2026, WhatsApp wamid.HBgMOTE5MDk5Nzk2ODExFQIAEhgUM0ExMDMzNDgzQUQ0MjU1NzYwQ0IA,
    // verbatim: "Instead of 3d model there should be car images"): the car room shows a
    // category portrait when a car has no uploaded photo, via the single sanctioned
    // CategoryCarImage wrapper. Everywhere else the rule stands: own photo or neutral icon.
    const ownerApproved = (p: string) => p.replace(/\\/g, "/").endsWith("src/ui/CategoryCarImage.tsx");
    const offenders = walk(`${root}/src`).filter((p) => !/preview|imagery\.ts|\.test\./.test(p) && !ownerApproved(p)).filter((p) => readFileSync(p, "utf8").includes("vehicleImagery"));
    expect(offenders).toEqual([]);
  });
});

describe("vehicle category portraits", () => {
  const imagery = () => readFileSync(`${root}/src/lib/imagery.ts`, "utf8");
  it("map only to pixel-verified car portraits, never service, scene or worker photos", () => {
    const s = imagery();
    // The exact allowlist: each file was pixel-inspected and shows an actual car
    // of that body style with no people, no service work and no visible plate.
    expect(s).toContain('import vehicleHatchback from "../../assets/imagery/stock/x-glossy-black.jpg";');
    expect(s).toContain('import vehicleSedan from "../../assets/imagery/curated/car.jpg";');
    expect(s).toContain('import vehicleSuv from "../../assets/imagery/stock/x-suv-garage.jpg";');
    expect(s).toContain('import vehicleLuxury from "../../assets/imagery/stock/x-black-reflect.jpg";');
    const block = s.slice(s.indexOf("export const vehicleImagery"), s.indexOf("};", s.indexOf("export const vehicleImagery")));
    // Regression: x-polish-red (worker polishing) once reached every category
    // through the heroAlt/vehicleSedan aliases. No scene or service alias may
    // ever appear in this map again.
    for (const banned of ["heroAlt", "heroHome", "serviceWashing", "serviceCeramic", "serviceCoating", "servicePpf", "serviceTinting", "serviceInspection", "serviceOther", "catWash", "catCeramic", "catPpf", "catDetailing", "catGarage", "catMods", "genCoating", "genPickup", "membership", "loginHero"]) {
      expect(block).not.toContain(banned);
    }
    expect(block).toContain("hatchback: vehicleHatchback,");
    expect(block).toContain("sedan: vehicleSedan,");
    expect(block).toContain("suv: vehicleSuv,");
    expect(block).toContain("luxury: vehicleLuxury,");
    // van and commercial have no verified portrait: they stay unmapped (fail closed).
    expect(block).not.toContain("van:");
    expect(block).not.toContain("commercial:");
  });
  it("every mapped portrait file exists", () => {
    for (const f of ["stock/x-glossy-black.jpg", "curated/car.jpg", "stock/x-suv-garage.jpg", "stock/x-black-reflect.jpg"]) {
      expect(existsSync(`${root}/assets/imagery/${f}`)).toBe(true);
    }
  });
  it("labels every category portrait as illustrative stock, never as the customer's own car", () => {
    const s = readFileSync(`${root}/src/ui/CategoryCarImage.tsx`, "utf8");
    // A category portrait is honest stock, not the customer's model: it must
    // carry a visible "Illustrative ... image" label. Own photos never pass
    // through this component, so the label can never land on them.
    expect(s).toContain("Illustrative ");
    expect(s).toContain("accessibilityLabel={label}");
    // The neutral icon fallback stays unlabelled: no photo, no claim.
    const iconBranch = s.slice(s.indexOf("if (!source)"), s.indexOf("const kind"));
    expect(iconBranch).not.toContain("Illustrative");
  });
  it("CategoryCarImage fails closed for unknown categories instead of showing another car", () => {
    const s = readFileSync(`${root}/src/ui/CategoryCarImage.tsx`, "utf8");
    // No silent default category: the old `"sedan"` fallback would show a sedan
    // photo for any unknown category, the same wrong-asset class as x-polish-red.
    expect(s).not.toContain('"sedan"');
    expect(s).toContain('Icon name="car"');
  });
});

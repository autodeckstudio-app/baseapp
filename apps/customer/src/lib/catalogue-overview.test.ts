import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MENU_CHIPS, MENU_GROUPS } from "@autodeck/core";
import { GROUP_PHOTO_CATEGORY, overviewGroups } from "./catalogue-overview";

const src = readFileSync(`${__dirname}/../app/(tabs)/catalogue/index.tsx`, "utf8");
describe("Services All view: one card per category", () => {
  it("shows exactly the categories the filter pills show, in the same order", () => {
    const pills = MENU_GROUPS.filter(() => true).map((g) => g.key);
    expect(overviewGroups(MENU_GROUPS, () => 1).map((g) => g.key)).toEqual(pills);
    expect(overviewGroups(MENU_GROUPS, (g) => (g.key === "ppf" ? 0 : 1)).map((g) => g.key)).not.toContain("ppf");
  });
  it("every popular chip category has an approved photo mapped", () => {
    for (const k of MENU_CHIPS) expect(GROUP_PHOTO_CATEGORY[k]).toBeTruthy();
  });
  it("every category card has a photo, including Pickup and drop (no fallback icon tile)", () => {
    for (const g of MENU_GROUPS) expect(GROUP_PHOTO_CATEGORY[g.key], g.key).toBeTruthy();
    expect(GROUP_PHOTO_CATEGORY["pickup"]).toBe("pickup");
    expect(readFileSync(`${__dirname}/imagery.ts`, "utf8")).toMatch(/pickup: genPickup/);
  });
  it("the cards and pills use the same five-home list and route-backed choice",()=>{
    const explorer=readFileSync(`${__dirname}/../ui/ServicesExplorer.tsx`,"utf8");
    expect(src).toContain("SERVICE_HOMES.map");expect(explorer).toContain("SERVICE_HOMES.map");
    expect(explorer).toContain("onPath({ home: h.key })");expect(src).toContain("value={path.home ?? \"all\"}");
    expect(src).not.toContain("buildTree(");expect(src).not.toContain("<PpfSelection");
  });
  it("All keeps large home cards, not a second list of every product",()=>{
    const explorer=readFileSync(`${__dirname}/../ui/ServicesExplorer.tsx`,"utf8");
    expect(explorer).toContain("if (!home)");expect(explorer).toContain("serviceHomeImages[h.key]");
    expect(explorer).toContain("<ServicePackageCard");expect(explorer).toContain('s.category!=="pickup"');
  });
});

import { AREA_SECTIONS, SERVICE_TYPES, areaSections, type TreeNode } from "./services-tree";
describe("area sections inside a category", () => {
  it("every type of a sectioned category is in exactly one section (nothing drops out, nothing is shown twice)", () => {
    for (const [g, secs] of Object.entries(AREA_SECTIONS)) {
      const placed = secs.flatMap((s) => s.keys);
      expect(new Set(placed).size).toBe(placed.length);
      expect([...placed].sort()).toEqual(SERVICE_TYPES[g]!.map((d) => d.key).sort());
    }
  });
  it("Wash & Care uses Meet's five areas in order, with the real services in them", () => {
    expect(AREA_SECTIONS["wash"]!.map((s) => s.label)).toEqual(["Exterior", "Interior", "Wheels and tyres", "Glass and lights", "Paint"]);
    const nodes: TreeNode[] = SERVICE_TYPES["wash"]!.map((d) => ({ kind: "enquiry" as const, key: d.key, label: d.label }));
    const secs = areaSections("wash", nodes);
    const by = Object.fromEntries(secs.map((s) => [s.label, s.nodes.map((n) => (n.kind === "enquiry" ? n.label : ""))]));
    expect(by["Exterior"]).toEqual(["Exterior wash", "Complete detailing", "Trim restoration"]);
    expect(by["Interior"]).toContain("Leather cleaning and conditioning");
    expect(by["Wheels and tyres"]).toEqual(["Wheel and tyre cleaning"]);
    expect(by["Glass and lights"]).toEqual(["Glass cleaning and water spots", "Headlight restoration"]);
    expect(by["Paint"]).toEqual(["Paint decontamination", "Polish and paint correction"]);
  });
  it("an unknown type still shows (last, under More), and an unsectioned category stays flat", () => {
    const n: TreeNode[] = [{ kind: "enquiry", key: "exterior", label: "A" }, { kind: "enquiry", key: "brand-new", label: "B" }];
    expect(areaSections("wash", n).map((s) => s.label)).toEqual(["Exterior", "More"]);
    expect(areaSections("ppf", n)).toEqual([{ label: "", nodes: n }]);
  });
  it("legacy category URLs normalize into the same home/family flow instead of a second section renderer",()=>{
    expect(src).toContain("routePath(params, all)");expect(src).toContain("<ServicesExplorer");
    expect(src).not.toContain("areaSections(");
  });
});

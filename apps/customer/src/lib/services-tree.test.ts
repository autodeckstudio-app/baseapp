import { describe, expect, it } from "vitest";
import { MENU_GROUPS, MENU_SEED } from "@autodeck/core";
import { buildTree, leafServices, pathToLabel, resolvePath } from "./services-tree";

const svc = (m: (typeof MENU_SEED)[number]) => ({ id: m.id, tenantId: "t", name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, priceOnRequest: m.consult === true, estimatedDurationMinutes: m.minutes, coverageLevel: m.coverageLevel, warrantyLabel: m.warrantyLabel, active: true, requiredBayType: m.bay }) as never;
const all = MENU_SEED.map(svc);
const group = (k: string) => MENU_GROUPS.find((g) => g.key === k)!;

describe("services drill-down tree", () => {
  it("coatings: type > brand > product", () => {
    const t = buildTree(group("coatings"), all);
    expect(t.map((n) => (n.kind === "branch" ? n.label : "leaf"))).toEqual(["Ceramic and graphene", "Surface add-ons"]);
    const ceramic = resolvePath(t, ["ceramic"]);
    expect(ceramic.nodes.map((n) => (n.kind === "branch" ? n.label : ""))).toEqual(["Fireball", "Kovalent", "3M", "AutoDeck Care"]);
    const fireball = resolvePath(t, ["ceramic", "Fireball"]);
    expect(fireball.nodes.every((n) => n.kind === "leaf")).toBe(true);
    expect(fireball.nodes.length).toBe(3);
  });
  it("ppf: brand > coverage products", () => {
    const t = buildTree(group("ppf"), all);
    expect(t.every((n) => n.kind === "branch")).toBe(true);
    expect(resolvePath(t, ["XPEL"]).nodes.length).toBe(3);
  });
  it("garage, wash and mods are short flat lists, nothing hidden behind a tap", () => {
    for (const k of ["garage", "wash", "mods"]) {
      const t = buildTree(group(k), all);
      expect(t.length).toBeGreaterThan(0);
      expect(t.every((n) => n.kind === "leaf")).toBe(true);
      expect(t.length).toBeLessThanOrEqual(8);
    }
  });
  it("every service in a group is reachable exactly once", () => {
    for (const g of MENU_GROUPS) {
      const ids = buildTree(g, all).flatMap(leafServices).map((s) => s.id).sort();
      const want = all.filter((s: { category: string }) => (g.categories as string[]).includes(s.category)).map((s: { id: string }) => s.id).sort();
      expect(ids).toEqual(want);
    }
  });
  it("a single child branch opens by itself; old ?brand= links resolve", () => {
    const only = [{ kind: "branch" as const, key: "a", label: "A", children: [{ kind: "branch" as const, key: "b", label: "B", children: [] }] }];
    expect(resolvePath(only, []).trail.map((t) => t.key)).toEqual(["a", "b"]);
    expect(pathToLabel(buildTree(group("coatings"), all), "Kovalent")).toEqual(["ceramic", "Kovalent"]);
  });
  it("no invented types: categories with no services produce no branch", () => {
    const noAddons = all.filter((s: { category: string }) => s.category !== "coating");
    expect(buildTree(group("coatings"), noAddons).map((n) => (n.kind === "branch" ? n.key : ""))).toEqual(["ceramic"]);
  });
});

import { describe, expect, it } from "vitest";
import { MENU_GROUPS, MENU_SEED } from "@autodeck/core";
import { SERVICE_TYPES, buildTree, leafServices, matchesQuery, pathToLabel, resolvePath } from "./services-tree";

const svc = (m: (typeof MENU_SEED)[number]) => ({ id: m.id, tenantId: "t", name: m.name, category: m.category, brand: m.brand, description: m.description, basePrice: m.rupees * 100, priceOnRequest: m.consult === true, estimatedDurationMinutes: m.minutes, coverageLevel: m.coverageLevel, warrantyLabel: m.warrantyLabel, active: true, requiredBayType: m.bay }) as never;
const all = MENU_SEED.map(svc);
const group = (k: string) => MENU_GROUPS.find((g) => g.key === k)!;

const labels = (ns: ReturnType<typeof buildTree>) => ns.map((n) => (n.kind === "leaf" ? n.service.name : n.label));
const kinds = (g: string) => buildTree(group(g), all).map((n) => n.kind);

describe("services type level", () => {
  it("every category opens on types; bookable types first, enquiry-only types last", () => {
    for (const k of ["wash", "coatings", "ppf", "garage", "mods"]) {
      const ks = kinds(k);
      expect(ks.every((x) => x !== "leaf")).toBe(true);
      const firstAsk = ks.indexOf("enquiry");
      if (firstAsk >= 0) expect(ks.slice(firstAsk).every((x) => x === "enquiry")).toBe(true);
    }
  });
  it("coatings: ceramic and graphene are separate types, ceramic goes brand > product", () => {
    const t = buildTree(group("coatings"), all);
    expect(labels(t).slice(0, 2)).toEqual(["Ceramic paint coating", "Graphene paint coating"]);
    expect(resolvePath(t, ["ceramic"]).nodes.map((n) => (n.kind === "branch" ? n.label : ""))).toEqual(["Fireball", "Kovalent", "3M", "AutoDeck Care"]);
    expect(resolvePath(t, ["ceramic", "Fireball"]).nodes.length).toBe(3);
    const graphene = leafServices(t.find((n) => n.kind === "branch" && n.key === "graphene")!);
    expect(graphene.map((s) => s.id)).toEqual(["menu-coat-kovalent-graphene"]);
  });
  it("tyre and dashboard protection have no service, so they are enquiry-only and never carry a year tier", () => {
    const t = buildTree(group("coatings"), all);
    for (const k of ["tyre", "dashboard", "matte", "ppf-coat"]) expect(t.find((n) => n.kind === "enquiry" && n.key === k)).toBeTruthy();
    const years = leafServices({ kind: "branch", key: "x", label: "x", children: t.filter((n) => n.kind === "branch") }).filter((s) => /year/i.test(s.warrantyLabel ?? ""));
    expect(years.every((s) => /^menu-coat-(autodeck|fireball|kovalent)/.test(s.id))).toBe(true);
  });
  it("ppf: colour is a film type, never a brand; brands are the four real ones", () => {
    const t = buildTree(group("ppf"), all);
    const film = resolvePath(t, ["brand-film"]).nodes.map((n) => (n.kind === "branch" ? n.label : ""));
    expect(film).toEqual(["Garware", "XPEL", "LLumar", "3M"]);
    expect(film).not.toContain("Colour films");
    expect(t.some((n) => n.kind === "branch" && n.key === "colour")).toBe(true);
  });
  it("window film, tyres-style invented work and seating stay enquiry or quote-only, never priced", () => {
    const film = leafServices(buildTree(group("mods"), all).find((n) => n.kind === "branch" && n.key === "film")!);
    expect(film.every((s) => s.priceOnRequest === true)).toBe(true);
    const t = buildTree(group("mods"), all);
    expect(t.find((n) => n.kind === "enquiry" && n.key === "seats")).toBeTruthy();
  });
  it("enquiry nodes carry no price, term or warranty", () => {
    for (const g of MENU_GROUPS) for (const n of buildTree(g, all)) if (n.kind === "enquiry") expect(Object.keys(n).sort()).toEqual(["blurb", "key", "kind", "label"].filter((k) => k in n).sort());
  });
  it("every service in a group is reachable exactly once", () => {
    for (const g of MENU_GROUPS) {
      const ids = buildTree(g, all).flatMap(leafServices).map((s) => s.id).sort();
      const want = all.filter((s: { category: string }) => (g.categories as string[]).includes(s.category)).map((s: { id: string }) => s.id).sort();
      expect(ids).toEqual(want);
    }
  });
  it("type ids named in the vocabulary exist in the menu", () => {
    const real = new Set(MENU_SEED.map((m) => m.id));
    for (const defs of Object.values(SERVICE_TYPES)) for (const d of defs) for (const id of d.ids ?? []) expect(real.has(id)).toBe(true);
  });
  it("a single child branch opens by itself; old ?brand= links resolve", () => {
    const only = [{ kind: "branch" as const, key: "a", label: "A", children: [{ kind: "branch" as const, key: "b", label: "B", children: [] }] }];
    expect(resolvePath(only, []).trail.map((t) => t.key)).toEqual(["a", "b"]);
    expect(pathToLabel(buildTree(group("coatings"), all), "Kovalent")).toEqual(["ceramic", "Kovalent"]);
  });
  it("search words land in the right type", () => {
    const hit = (q: string) => all.filter((s: never) => matchesQuery(s, q)).map((s: { id: string }) => s.id);
    expect(hit("graphene")).toContain("menu-coat-kovalent-graphene");
    expect(hit("upholstery")).toContain("menu-coat-fabric");
    expect(hit("tint")).toContain("menu-mods-tint");
    expect(hit("tyre")).toContain("menu-garage-alignment");
    expect(hit("dashboard")).toEqual([]);
  });
});

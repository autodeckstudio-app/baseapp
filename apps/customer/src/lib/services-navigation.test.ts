import { it, expect } from "vitest";
import type { Service } from "@autodeck/core";
import {
  currentServices,
  familyChoices,
  servicePlacement,
  referencePlacement,
  referenceChoices,
  routePath,
  parentPath,
  pathParams,
  serviceSearch,
} from "./services-navigation";
import fixture from "./service-selection-live-fixture.json";
import { BRAND_ENQUIRIES } from "./brand-enquiries";
const s = (id: string, name: string, category: string, more = {}) =>
  ({ id, name, category, active: true, ...more }) as Service;
it("one exact five-home placement per active confirmed service, no record data changed", () => {
  const rows = fixture as unknown as Service[];
  const active = rows.map((x) => ({ ...x, active: true }));
  const shown = currentServices([
    ...active,
    active[0]!,
    { ...active[0]!, id: "unconfirmed" },
    { ...active[1]!, active: false },
  ]);
  expect(new Set(shown.map((s) => s.id)).size).toBe(shown.length);
  for (const row of shown) {
    if (row.category === "pickup") expect(servicePlacement(row)).toBeNull();
    else expect(servicePlacement(row)?.home).toBeTruthy();
    expect(active).toContain(row);
  }
});
it("all Washing records stay in one washing home, including interior and complete wash", () => {
  for (const name of [
    "Interior deep clean",
    "Full detail wash",
    "Detail SPA",
    "Ceramic wash",
  ])
    expect(servicePlacement(s("x", name, "washing"))?.home).toBe("washing");
});
it("film aftercare is not film installation, surface coatings never become ceramic paint", () => {
  expect(
    servicePlacement(
      s("x", "Gtechniq HALOv2 Flexible Film Coating", "coating"),
    ),
  ).toEqual({ home: "detailing", family: "Film aftercare" });
  expect(
    servicePlacement(s("x", "CarPro CQUARTZ Skin", "coating"))?.family,
  ).toBe("Film aftercare");
  expect(
    servicePlacement(s("x", "CarPro DQUARTZ GForce", "coating"))?.family,
  ).toBe("Glass");
  expect(
    servicePlacement(s("x", "CarPro CQUARTZ BlackOut 2.0", "coating"))?.family,
  ).toBe("Tyres & rubber");
});
it("paint has all three service TYPES even with no confirmed film/spray stock, modifications retains colour-film service type", () => {
  expect(familyChoices("paint", [], [])).toEqual(["Ceramic", "PPF", "PPS"]);
  expect(familyChoices("modifications", [], [])).toContain("Colour PPF");
  expect(referenceChoices([]).some((r) => r.group === "ppf")).toBe(false);
});
it("same published range does not reappear as a reference; no similar-tier merge", () => {
  const xs = [
    s(
      "svc-brand-kovalent-graphene-matrix",
      "Kovalent Graphene Matrix",
      "ceramic",
      { brand: "Kovalent" },
    ),
  ];
  const refs = referenceChoices(xs);
  expect(refs.map((r) => r.key)).not.toContain("kovalent-matrix");
  expect(referenceChoices([]).map((r) => r.key)).toContain("kovalent-matrix");
  expect(
    referenceChoices([
      s("menu-coat-kovalent-graphene", "Kovalent Graphene 7-year", "ceramic", {
        brand: "Kovalent",
      }),
    ]).map((r) => r.key),
  ).toContain("kovalent-matrix");
});
it("every confirmed reference has exactly one home/family placement", () => {
  for (const r of BRAND_ENQUIRIES)
    expect(referencePlacement(r).home).toMatch(/paint|detailing/);
});
it("old chips/deep links normalize to the same hierarchy instead of a parallel tree", () => {
  expect(routePath({ cat: "wash" }, [])).toEqual({ home: "washing" });
  expect(routePath({ cat: "ppf" }, [])).toEqual({
    home: "paint",
    family: "PPF",
  });
  expect(routePath({ cat: "coatings", p: "glass" }, [])).toEqual({
    home: "detailing",
    family: "Glass",
  });
  expect(
    routePath({ cat: "coatings", p: "ceramic,Kovalent" }, [
      s("x", "Kovalent Graphene", "ceramic", { brand: "Kovalent" }),
    ]),
  ).toEqual({ home: "paint", family: "Ceramic", brand: "Kovalent" });
  expect(routePath({ need: "tint" }, [])).toEqual({ home: "modifications" });
});
it("URL params and Back preserve real family/work/brand hierarchy and remove deeper choices", () => {
  let path = {
    home: "paint" as const,
    family: "PPF",
    work: "removal",
    brand: "XPEL",
  };
  expect(pathParams(path)).toEqual(path);
  expect(parentPath(path)).toEqual({
    home: "paint",
    family: "PPF",
    work: "removal",
  });
  expect(parentPath(parentPath(path))).toEqual({
    home: "paint",
    family: "PPF",
  });
  expect(parentPath({ home: "paint", family: "Ceramic" })).toEqual({
    home: "paint",
  });
  expect(parentPath({ home: "paint" })).toEqual({});
});
it("global search finds the same exact offering by actual product, brand or canonical family", () => {
  const x = s("x", "CarPro DQUARTZ GForce", "coating", { brand: "CarPro" });
  for (const q of ["GForce", "carpro", "Glass"])
    expect(serviceSearch(x, q)).toBe(true);
  expect(serviceSearch(x, "film installation")).toBe(false);
});

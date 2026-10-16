import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { visitServices, visitTitle, visitAlso, VISIT_FALLBACK } from "./visit-services";
const cat = { s1: "Quick wash" };
const inv = (...d: string[]) => ({ lineItems: d.map((description) => ({ description })) });
describe("what a visit was for", () => {
  it("one service", () => expect(visitTitle(visitServices({ serviceId: "s1" }, inv("Quick wash"), cat))).toBe("Quick wash"));
  it("invoice lines win, fees are not services, duplicates collapse", () => {
    expect(visitServices({ serviceId: "s1" }, inv("Quick wash", "Pickup Fee", "Drop Fee", "Quick wash", "Polish"), cat)).toEqual(["Quick wash", "Polish"]);
  });
  it("falls back to the catalogue when there is no invoice yet", () => expect(visitServices({ serviceId: "s1" }, null, cat)).toEqual(["Quick wash"]));
  it("unknown everything shows a plain label, not Studio visit", () => {
    expect(visitTitle(visitServices({ serviceId: "gone" }, undefined, cat))).toBe(VISIT_FALLBACK);
    expect(VISIT_FALLBACK).not.toMatch(/studio visit/i);
  });
  it("multiples: two are joined, three or more collapse and the full list is shown below", () => {
    expect(visitTitle(["A", "B"])).toBe("A + B");
    expect(visitTitle(["A", "B", "C"])).toBe("A + 2 more");
    expect(visitAlso(["A", "B", "C"])).toBe("A, B, C");
    expect(visitAlso(["A", "B"])).toBeNull();
  });
  it("no screen falls back to the literal Studio visit", () => {
    for (const f of ["app/(tabs)/garage/history.tsx", "app/(tabs)/garage/[id].tsx"]) expect(readFileSync(`${__dirname}/../${f}`, "utf8")).not.toContain('"Studio visit"');
  });
});

describe("history invoice button spacing", () => {
  it("is padded away from the row divider and the card edge", () => {
    expect(readFileSync("src/app/(tabs)/garage/history.tsx", "utf8")).toMatch(/paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12/);
  });
});

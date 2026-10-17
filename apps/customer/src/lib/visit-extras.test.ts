import { describe, expect, it } from "vitest";
import { MAX_EXTRAS, canAddExtra, eligibleExtras, extrasFromParam, extrasToParam, toggleExtra } from "./visit-extras";

const s = (id: string, over: object = {}) => ({ id, requiredBayType: "wash", priceOnRequest: false, active: true, ...over }) as never;
describe("visit extras", () => {
  const main = s("main");
  it("same bay, live, priced services only", () => {
    expect(canAddExtra(main, s("a"))).toBe(true);
    expect(canAddExtra(main, s("main"))).toBe(false);
    expect(canAddExtra(main, s("a", { requiredBayType: "garage" }))).toBe(false);
    expect(canAddExtra(main, s("a", { priceOnRequest: true }))).toBe(false);
    expect(canAddExtra(main, s("a", { active: false }))).toBe(false);
    expect(canAddExtra(s("q", { priceOnRequest: true }), s("a"))).toBe(false);
    expect(eligibleExtras(main, [s("a"), s("b", { requiredBayType: "garage" })]).map((x: { id: string }) => x.id)).toEqual(["a"]);
  });
  it("toggle adds, removes, and stops at the cap", () => {
    let p: string[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) p = toggleExtra(p, id);
    expect(p).toHaveLength(MAX_EXTRAS);
    expect(toggleExtra(p, "a")).toEqual(["b", "c", "d"]);
  });
  it("round trips through the route param", () => {
    expect(extrasFromParam(extrasToParam(["a", "b"]))).toEqual(["a", "b"]);
    expect(extrasFromParam(undefined)).toEqual([]);
    expect(extrasFromParam("a,a,,b")).toEqual(["a", "b"]);
  });
});

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

import { eligibleExtras as _el, offeredExtras, toggleExtra as _tg } from "./visit-extras";
describe("a bundle and the services it includes are never in one visit", () => {
  const cat = ["menu-wash-foam", "menu-wash-exterior", "menu-wash-interior", "menu-wash-full"].map((id) => ({ id, requiredBayType: "wash" as const, priceOnRequest: false, active: true }));
  it("main Full detail wash: Exterior, Interior and Foam are not offered", () => {
    expect(_el(cat[3]!, cat).map((x) => x.id)).toEqual([]);
  });
  it("main Exterior: Full detail wash is not offered either (book Full instead)", () => {
    expect(_el(cat[1]!, cat).map((x) => x.id)).toEqual(["menu-wash-interior"]);
  });
  it("picking Full drops Exterior and Interior already picked; once Full is picked they are hidden", () => {
    expect(_tg(["menu-wash-exterior", "menu-wash-interior"], "menu-wash-full")).toEqual(["menu-wash-full"]);
    const shown = offeredExtras(_el(cat[2]!, cat), ["menu-wash-full"]).map((x) => x.id);
    expect(shown).toEqual([]);
  });
  it("Foam is not offered with Exterior or Full, and they are not offered with Foam", () => {
    expect(_el(cat[0]!, cat).map((x) => x.id)).toEqual(["menu-wash-interior"]);
  });
});

import { applyBundleUpgrade, bundleUpgradeNote } from "./visit-extras";
describe("Exterior + Interior becomes the Full detail wash", () => {
  it("main Exterior + extra Interior: Full becomes the main service, other extras stay", () => {
    expect(applyBundleUpgrade("menu-wash-exterior", ["menu-wash-interior", "menu-wash-foam"])).toEqual({ primaryId: "menu-wash-full", extras: ["menu-wash-foam"], upgradedTo: "menu-wash-full" });
  });
  it("main Foam + both as extras: Full replaces the two extras", () => {
    expect(applyBundleUpgrade("menu-wash-foam", ["menu-wash-exterior", "menu-wash-interior"])).toEqual({ primaryId: "menu-wash-foam", extras: ["menu-wash-full"], upgradedTo: "menu-wash-full" });
  });
  it("one part alone, or Full already present, changes nothing", () => {
    expect(applyBundleUpgrade("menu-wash-foam", ["menu-wash-exterior"]).upgradedTo).toBeNull();
    expect(applyBundleUpgrade("menu-wash-full", []).upgradedTo).toBeNull();
  });
});

describe("bundle upgrade note", () => {
  it("says switched only when the main service changes", () => {
    const sw = applyBundleUpgrade("menu-wash-exterior", ["menu-wash-interior"]);
    expect(bundleUpgradeNote("menu-wash-exterior", sw)).toContain("switched you");
  });
  it("says added when the bundle is only added as an extra, and never says switched", () => {
    const add = applyBundleUpgrade("menu-wash-foam", ["menu-wash-exterior", "menu-wash-interior"]);
    expect(add.primaryId).toBe("menu-wash-foam");
    expect(bundleUpgradeNote("menu-wash-foam", add)).toContain("added it to your visit");
    expect(bundleUpgradeNote("menu-wash-foam", add)).not.toContain("switched");
  });
  it("has no note when no bundle applies", () => {
    expect(bundleUpgradeNote("menu-wash-full", applyBundleUpgrade("menu-wash-full", []))).toBeNull();
  });
});

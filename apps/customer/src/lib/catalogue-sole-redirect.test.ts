import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { soleServiceRedirect } from "./catalogue-sole-redirect";

const src = readFileSync(`${__dirname}/../app/(tabs)/catalogue/index.tsx`, "utf8");
const base = { focused: true, searching: false, fromRoute: "coatings", catGroup: "coatings", soleLeaf: "svc-maintenance-coat" };

describe("soleServiceRedirect: single-service category opens its service directly", () => {
  it("redirects while the catalogue screen is focused", () => {
    expect(soleServiceRedirect(base)).toBe("svc-maintenance-coat");
  });
  it("never redirects while the screen is mounted but unfocused (stale-screen drift regression)", () => {
    // The index screen stays mounted underneath pushed pages; its late async load must not hijack the visible page.
    expect(soleServiceRedirect({ ...base, focused: false })).toBeUndefined();
  });
  it("does not redirect while searching, without a route-chosen group, or without a single leaf", () => {
    expect(soleServiceRedirect({ ...base, searching: true })).toBeUndefined();
    expect(soleServiceRedirect({ ...base, fromRoute: undefined })).toBeUndefined();
    expect(soleServiceRedirect({ ...base, catGroup: undefined })).toBeUndefined();
    expect(soleServiceRedirect({ ...base, soleLeaf: undefined })).toBeUndefined();
  });
  it("canonical catalogue never lets a background single-service result hijack a visible page",()=>{
    expect(src).not.toContain("soleServiceRedirect(");expect(src).not.toContain("soleId");
    expect(src).toContain("setServices(rows)");
    // User-requested details stay inside the comparison popup, without a route push.
    expect(src).toContain("router.push({pathname:`/(tabs)/catalogue/${s.id}` as never");
    expect(src).toContain("onOpen={(s)=>setDetailId(s.id)}");
    expect(src).toContain("<ServiceDetailScreen key={detailId} serviceId={detailId} embedded/>");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// One left menu everywhere: both places that open it must build it from the same list.
describe("unified left menu", () => {
  it("Home and the common header share one builder", () => {
    expect(read("ui/AppBar.tsx")).toContain("buildDrawerItems(");
    expect(read("app/(tabs)/index.tsx")).toContain("buildDrawerItems(");
    expect(read("ui/AppBar.tsx")).not.toMatch(/key: "membership"/);
    expect(read("app/(tabs)/index.tsx")).not.toMatch(/key: "buycar"/);
  });
  it("Buy and Sell is one entry, ahead of Membership, and opens the one Cars screen", () => {
    const s = read("lib/drawer-items.ts");
    const i = (k: string) => s.indexOf(`key: "${k}"`);
    expect(i("cars")).toBeGreaterThan(-1);
    expect(s).not.toContain('key: "buycar"');
    expect(s).not.toContain('key: "sellcar"');
    expect(s).toContain('label: "Buy & Sell"');
    expect(i("cars")).toBeLessThan(i("membership"));
    expect(i("membership")).toBeLessThan(i("help"));
  });
  it("the Cars screen holds Buy and Sell behind one BUY | SELL switch and is built in CarsHub", () => {
    const hub = read("ui/CarsHub.tsx");
    expect(hub).toContain('"BUY" : "SELL"');
    expect(hub).toContain("FeatureCard");
    expect(hub).toContain("RowCard");
    expect(read("app/(tabs)/cars/index.tsx")).toContain("<CarsHub");
  });
  it("the result count uses the right verb for one car", () => {
    const hub = read("ui/CarsHub.tsx");
    expect(hub).toContain('shown.length === 1 ? " matches your search" : " match your search"');
  });
  it("car photos come only from the listing: no stock, generated or fallback image, and a missing photo says so", () => {
    const hub = read("ui/CarsHub.tsx");
    expect(hub).not.toMatch(/imagery|stock\/|generated|CarThumb|require\(/);
    expect(hub).toContain('No photo');
    expect(hub.match(/photoUrls\[0\]/g)?.length).toBe(2);
    expect(read("app/preview-cars.tsx")).not.toMatch(/imagery|jpg|require\(/);
  });
});

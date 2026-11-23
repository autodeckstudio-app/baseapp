import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Help lives beside Notifications; neither header exposes a menu.
describe("header navigation and legacy route data", () => {
  it("shared and Home headers expose Help without a drawer or profile menu", () => {
    for (const file of ["ui/AppBar.tsx", "ui/HomeOriginalTop.tsx"]) {
      const source = read(file);
      expect(source).toContain('accessibilityLabel="Help & contact"');
      expect(source).toContain('Notifications');
      expect(source).not.toContain('buildDrawerItems(');
      expect(source).not.toContain('SideDrawer');
    }
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

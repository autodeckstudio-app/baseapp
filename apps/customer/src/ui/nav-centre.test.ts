import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("bottom nav", () => {
  it("Home is the centre tab and draws the AD monogram; the others are thin-line icons", () => {
    const layout = read("app/(tabs)/_layout.tsx");
    const order = ['name="bookings"', 'name="catalogue"', 'name="index"', 'name="garage"', 'name="profile"'].map((n) => layout.indexOf(`<Tabs.Screen ${n}`));
    expect(order.every((x) => x > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const bar = read("ui/RaisedTabBar.tsx");
    expect(bar).toMatch(/route\.name === "index"[\s\S]*<AdMonogram/);
    expect(bar).toContain("<NavIcon");
    expect(read("ui/NavIcon.tsx")).toContain('stroke-width="1.5"');
  });
});

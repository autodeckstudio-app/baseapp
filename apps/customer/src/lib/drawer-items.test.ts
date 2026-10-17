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
  it("lists Buy, Sell and Membership in order", () => {
    const s = read("lib/drawer-items.ts");
    const i = (k: string) => s.indexOf(`key: "${k}"`);
    expect(i("buycar")).toBeGreaterThan(-1);
    expect(i("buycar")).toBeLessThan(i("sellcar"));
    expect(i("sellcar")).toBeLessThan(i("membership"));
    expect(i("membership")).toBeLessThan(i("help"));
  });
});

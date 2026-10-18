import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GOALS, GROUP_ZONES, ZONE_NODES, unreachableTypes, zonesOf } from "./service-zones";
import { SERVICE_TYPES } from "./services-tree";

describe("car-first services picker", () => {
  it("every type of every group is reachable from some zone, and zones name only real types", () => {
    for (const g of Object.keys(SERVICE_TYPES)) {
      expect(unreachableTypes(g)).toEqual([]);
      const keys = new Set(SERVICE_TYPES[g]!.map((d) => d.key));
      for (const z of zonesOf(g)) for (const t of z.types) expect(keys.has(t)).toBe(true);
    }
    expect(Object.keys(GROUP_ZONES).sort()).toEqual(Object.keys(SERVICE_TYPES).sort());
  });
  it("goals open a real group and a zone that group has", () => {
    for (const goal of GOALS) expect(zonesOf(goal.group).some((z) => z.key === goal.zone)).toBe(true);
  });
  it("every zone node exists in the shipped model file", () => {
    const d = readFileSync(join(__dirname, "../../public/models/hero-coupe.glb"));
    const json = JSON.parse(d.subarray(20, 20 + d.readUInt32LE(12)).toString("utf8")) as { nodes: Array<{ name?: string }> };
    const names = new Set(json.nodes.map((n) => n.name));
    for (const z of Object.values(ZONE_NODES)) expect(names.has(z.node)).toBe(true);
  });
  it("the model credit file ships with the model (CC BY 4.0)", () => {
    expect(readFileSync(join(__dirname, "../../public/models/hero-coupe-ATTRIBUTION.txt"), "utf8")).toMatch(/Creative Commons Attribution 4\.0/);
  });
  it("no zone or label claims a fit to the customer's own car", () => {
    expect(JSON.stringify(GROUP_ZONES)).not.toMatch(/your car|fits|warranty|year/i);
  });
  it("the Services page shows the model credit and a non-3D way to pick a zone", () => {
    const page = readFileSync(join(__dirname, "../app/(tabs)/catalogue/index.tsx"), "utf8");
    expect(page).toMatch(/CC BY 4\.0/);
    expect(page).toMatch(/zones\.map\(\(z\) => \(\s*<Pressable/);
  });
  it("the 3D car loads lazily, honours reduced motion and data saver, and keeps a poster fallback", () => {
    const web = readFileSync(join(__dirname, "../ui/ZoneCar.web.tsx"), "utf8");
    expect(web).toMatch(/prefers-reduced-motion/);
    expect(web).toMatch(/saveData/);
    expect(web).toMatch(/requestIdleCallback/);
    expect(web).toMatch(/hero-coupe-poster\.webp/);
    expect(web).toMatch(/touchAction = "pan-y"/);
  });
});

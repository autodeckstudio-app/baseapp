import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");

describe("one car photo source", () => {
  it("Home carousel and stage render the car through CarThumb, like Garage, for every car", () => {
    const home = read("ui/CarChips.tsx");
    const stage = read("ui/HeroStage.tsx");
    expect(home).toContain("<CarThumb car={car.vehicle}");
    expect(stage).toContain("<CarThumb car={car.vehicle}");
    expect(home).not.toMatch(/source=\{\{ uri: c\.photo/);
    expect(read("ui/GarageShowroom.tsx")).toContain("<CarThumb car={v}");
  });
  it("Home passes every vehicle's own photo fields, not only the active car's", () => {
    expect(read("app/(tabs)/index.tsx")).toContain("vehicle: { photoUrl: v.photoUrl");
  });
  it("Edit vehicle uploaders have distinct labels", () => {
    const g = read("app/(tabs)/garage/[id].tsx");
    expect(g).toMatch(/car photo"/);
    expect(g).toMatch(/RC photo"/);
    const labels = [...g.matchAll(/<FileUploader label=\{[^}]*"((?:Add|Replace) (?:car|RC) photo)"/g)].map((m) => m[1]);
    expect(labels.length).toBe(2);
  });
});

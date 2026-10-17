import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAR_SEGMENTS, STAFF_SEGMENTS, normalizeSegment, segmentLabel } from "./car-segments";
import { sizeTierOf } from "./menu";

describe("car segments", () => {
  it("offers market segments only, never luxury", () => {
    expect(CAR_SEGMENTS.map((s) => s.value)).toEqual(["hatchback", "sedan", "suv", "van"]);
    expect(STAFF_SEGMENTS.some((s) => s.label.toLowerCase().includes("luxury"))).toBe(false);
  });
  it("reads legacy luxury as SUV and keeps price tiers aligned", () => {
    expect(normalizeSegment("luxury")).toBe("suv");
    expect(segmentLabel("luxury")).toBe("SUV");
    expect(segmentLabel("van")).toBe("MUV / XUV");
    expect(normalizeSegment(null)).toBeNull();
    expect(sizeTierOf("luxury")).toBe(sizeTierOf("suv"));
  });
  it("no app screen shows a Luxury label", () => {
    const root = join(__dirname, "../../../apps");
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".next" || n === "dist" || n === "dist-local" || n === "design") continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n) && !/\.test\./.test(n) && /label: "Luxury|"Luxury"|Luxury \/|Luxury\//.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});

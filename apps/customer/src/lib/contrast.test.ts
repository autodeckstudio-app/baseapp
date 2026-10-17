import { describe, expect, it } from "vitest";
import { applyCustomerRaisedTheme, lightColors, nightColors } from "../../../../packages/ui/src/theme/colors";

applyCustomerRaisedTheme(); // the palette the customer app really runs with

const lin = (v: number) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]; return (x + 0.05) / (y + 0.05); };

// Surfaces the customer app really draws on (lib/raised.ts): Day card, Day ground, Night card, Night ground.
const DAY = ["#FFFFFF", "#F3F2EF"];
const NIGHT = ["#1B1B1F", "#0F1013"];

describe("text contrast meets WCAG AA (4.5:1)", () => {
  for (const [label, c, surfaces] of [["Day", lightColors, DAY], ["Night", nightColors, NIGHT]] as const) {
    for (const key of ["textPrimary", "textSecondary", "textTertiary"] as const) {
      for (const s of surfaces) {
        it(`${label} ${key} on ${s}`, () => {
          expect(ratio(c[key], s)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
  it("Day and Night accent text (accentStrong) on the card", () => {
    expect(ratio(lightColors.accentStrong, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(nightColors.accentStrong, "#1B1B1F")).toBeGreaterThanOrEqual(4.5);
  });
});

import { DAY_ATMOSPHERE as ATM, contrastRatio } from "@autodeck/ui/theme";
describe("Day atmosphere keeps text readable at its strongest light", () => {
  it("primary and secondary text pass 4.5:1 over every light at full strength", () => {
    const base = [251, 248, 243];
    const lights = [...ATM.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g)].map((m) => m.slice(1).map(Number));
    expect(lights.length).toBe(4);
    for (const l of lights) {
      const c = base.map((b, i) => Math.round(b * (1 - l[3]!) + l[i]! * l[3]!));
      const hex = "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
      for (const t of [lightColors.textPrimary, lightColors.textSecondary]) expect(contrastRatio(t, hex)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

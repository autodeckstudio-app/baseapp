import { describe, expect, it } from "vitest";
import { contrastRatio, darkColors, lightColors, glass, themeStylesheet, type ThemeColors } from "@autodeck/ui/theme";

function textPasses(c: ThemeColors, bg: string) {
  expect(contrastRatio(c.textPrimary, bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(c.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(c.textTertiary, bg)).toBeGreaterThanOrEqual(4.5);
}

describe("theme tokens", () => {
  it("dark text roles meet 4.5:1 on canvas and surfaces", () => {
    textPasses(darkColors, darkColors.canvas);
    textPasses(darkColors, darkColors.surface);
    // worst case glass: the no-blur fallback fill over canvas
    expect(contrastRatio(darkColors.textSecondary, darkColors.surfaceElevated)).toBeGreaterThanOrEqual(4.5);
  });

  it("light text roles meet 4.5:1 on canvas and surfaces", () => {
    textPasses(lightColors, lightColors.canvas);
    textPasses(lightColors, lightColors.surface);
  });

  it("accent buttons keep their label readable", () => {
    expect(contrastRatio(darkColors.textOnAccent, darkColors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightColors.textOnAccent, lightColors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("danger reads on the dark ground", () => {
    expect(contrastRatio(darkColors.danger, darkColors.canvas)).toBeGreaterThanOrEqual(4.5);
  });

  it("glass is central: every theme has a blurred fill and a readable fallback", () => {
    for (const g of Object.values(glass)) {
      expect(g.blur).toBeGreaterThanOrEqual(20);
      expect(g.fill).toMatch(/linear-gradient/);
      expect(g.fallbackFill).toMatch(/rgba\(.*0\.9\d?\)/);
    }
  });

  it("stylesheet exposes glass, ambient and a light override", () => {
    const css = themeStylesheet();
    expect(css).toContain("--ad-glass-blur: blur(24px) saturate(1.6)");
    expect(css).toContain("--ad-ambient:");
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("prefers-reduced-motion");
  });
});

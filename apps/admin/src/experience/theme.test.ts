import { describe, expect, it } from "vitest";
import { contrastRatio, darkColors, lightColors, nightColors, nightGround, nightOrange, nightButtonStyle, nightButtonText, glass, themeStylesheet, resolveMode, type ThemeColors } from "@autodeck/ui/theme";

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

  it("night mode: Coal Mine ground, readable text, same orange as the brand", () => {
    expect(nightColors.canvas).toBe("#50504D");
    textPasses(nightColors, nightColors.canvas);
    textPasses(nightColors, nightColors.surface);
    textPasses(nightColors, nightColors.surfaceElevated);
    expect(contrastRatio("#FFD0A6", nightColors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(nightColors.textOnAccent, nightColors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(nightColors.danger, nightColors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(nightColors.accent).toBe("#EC8638");
  });

  it("night gradients and translucent actions remain readable at every stop", () => {
    expect(nightGround).toContain("#50504D");
    expect(nightGround).toContain("radial-gradient");
    expect(nightOrange).toContain("rgba(236,134,56,.18)");
    expect(nightOrange).toContain("rgba(255,255,255,0) 42%");
    expect(nightButtonStyle.backgroundColor).toBe("transparent");
    expect(nightButtonStyle.backdropFilter).toContain("blur(18px)");
    for (const bg of ["#60605B", "#64645F", "#575752", "#41413E"]) textPasses(nightColors, bg);
    // Composite the real orange stops over the brightest ground and card stops.
    // Label occupies the clear middle; allow 2% residual white reflection.
    for (const ground of [[100,100,95], [87,87,82], [65,65,62]]) {
      for (const [orange, alpha] of [[[245,154,78], .22], [[236,134,56], .20], [[236,134,56], .18]] as const) {
        const bg = ground.map((v, i) => Math.round((v * (1-alpha) + orange[i]! * alpha) * .98 + 255 * .02));
        const hex = "#" + bg.map(v => v.toString(16).padStart(2,"0")).join("");
        expect(contrastRatio(nightButtonText, hex)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrastRatio("#FFD0A6", "#575752")).toBeGreaterThanOrEqual(4.5);
  });

  it("auto mode: night by clock or device preference", () => {
    const at = (h: number) => new Date(2026, 9, 11, h, 0, 0);
    expect(resolveMode(at(5), false)).toBe("night");
    expect(resolveMode(at(6), false)).toBe("light");
    expect(resolveMode(at(18), false)).toBe("light");
    expect(resolveMode(at(19), false)).toBe("night");
    expect(resolveMode(at(12), true)).toBe("night");
  });
});

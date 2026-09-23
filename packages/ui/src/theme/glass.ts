// Glass morphism: the one raised material (spec §3.5, legacy "liquid glass").
//
// A pane is a lit top edge, a blurred translucent fill and a shadow beneath.
// Rules the primitives enforce:
//   - Glass never sits on glass. One translucent layer over the lit ground.
//   - The fill stays readable without a blur: `fallbackFill` is what shows
//     when backdrop-filter is unsupported, reduced transparency is on, or a
//     low-end Android device skips the blur.
//   - Tone (a state's hue) may colour the edge only, and only when the state
//     is the subject of the pane.
import type { ThemeName } from "./colors.js";

export interface GlassRecipe {
  /** Gradient fill over the blur (web `background`). */
  fill: string;
  /** Stronger fill for the hero/selected pane. */
  fillLit: string;
  /** Amber-lit fill for the one working/active pane. */
  fillWarm: string;
  /** Champagne-lit fill for premium (membership/protection) panes. */
  fillCool: string;
  /** Solid-enough fill when there is no blur. */
  fallbackFill: string;
  /** Flat translucent fill for chrome (nav bars, toasts, palettes). */
  chromeFill: string;
  /** Hairline edge. */
  edge: string;
  /** The lit top edge, as an inset highlight. */
  sheen: string;
  /** Backdrop blur radius in px, and saturation multiplier. */
  blur: number;
  saturate: number;
  /** Chrome (nav) blur, a touch stronger. */
  chromeBlur: number;
  /** Native: BlurView intensity (0-100) and tint. */
  nativeIntensity: number;
  nativeTint: "dark" | "light";
}

export const glass: Record<ThemeName, GlassRecipe> = {
  dark: {
    fill: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.022))",
    fillLit: "linear-gradient(160deg, rgba(255,255,255,0.085), rgba(255,255,255,0.030))",
    fillWarm: "linear-gradient(160deg, rgba(224,164,92,0.14), rgba(255,255,255,0.025))",
    fillCool: "linear-gradient(160deg, rgba(232,217,190,0.12), rgba(255,255,255,0.022))",
    fallbackFill: "rgba(21,22,26,0.92)",
    chromeFill: "rgba(21,22,26,0.72)",
    edge: "rgba(255,255,255,0.09)",
    sheen: "rgba(255,255,255,0.13)",
    blur: 24,
    saturate: 1.6,
    chromeBlur: 28,
    nativeIntensity: 40,
    nativeTint: "dark",
  },
  light: {
    fill: "linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.58))",
    fillLit: "linear-gradient(160deg, rgba(255,255,255,0.92), rgba(255,255,255,0.70))",
    fillWarm: "linear-gradient(160deg, rgba(122,82,30,0.10), rgba(255,255,255,0.70))",
    fillCool: "linear-gradient(160deg, rgba(122,82,30,0.06), rgba(255,255,255,0.72))",
    fallbackFill: "rgba(255,255,255,0.96)",
    chromeFill: "rgba(243,243,242,0.85)",
    edge: "rgba(20,21,23,0.08)",
    sheen: "rgba(255,255,255,0.60)",
    blur: 24,
    saturate: 1.4,
    chromeBlur: 28,
    nativeIntensity: 60,
    nativeTint: "light",
  },
};

export type GlassFill = "base" | "lit" | "warm" | "cool";

export function glassFill(recipe: GlassRecipe, fill: GlassFill): string {
  switch (fill) {
    case "lit":
      return recipe.fillLit;
    case "warm":
      return recipe.fillWarm;
    case "cool":
      return recipe.fillCool;
    default:
      return recipe.fill;
  }
}

// ── Ambient field ──────────────────────────────────────────────────────
// The far wall glass refracts. Light, not a surface: it never carries
// meaning, never becomes a card, and is only seen through glass. Three
// overlapping lights so it reads as atmosphere, not a spotlight.
export interface AmbientLight {
  color: string;
  /** Percent of viewport. */
  x: number;
  y: number;
  /** vmax. */
  size: number;
  opacity: number;
}

export const ambient: Record<ThemeName, readonly AmbientLight[]> = {
  dark: [
    { color: "#E0A45C", x: 12, y: 8, size: 70, opacity: 0.1 },
    { color: "#E8D9BE", x: 88, y: 30, size: 55, opacity: 0.06 },
    { color: "#F0C48C", x: 40, y: 100, size: 60, opacity: 0.05 },
  ],
  light: [
    { color: "#E0A45C", x: 12, y: 8, size: 70, opacity: 0.08 },
    { color: "#E8D9BE", x: 88, y: 30, size: 55, opacity: 0.1 },
    { color: "#F0C48C", x: 40, y: 100, size: 60, opacity: 0.06 },
  ],
};

export const ambientDrift = { distance: 6, durationMs: 32_000 } as const;

export function ambientBackground(lights: readonly AmbientLight[], base: string): string {
  const layers = lights.map((l) => {
    const a = Math.round(l.opacity * 255)
      .toString(16)
      .padStart(2, "0");
    return `radial-gradient(${l.size}vmax ${l.size}vmax at ${l.x}% ${l.y}%, ${l.color}${a}, transparent 70%)`;
  });
  return [...layers, base].join(", ");
}

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
    fill: "linear-gradient(160deg, #FFFFFF, rgba(255,255,255,0.86))",
    fillLit: "linear-gradient(160deg, #FFFFFF, #FFFFFF)",
    fillWarm: "linear-gradient(160deg, rgba(242,122,26,0.07), rgba(255,255,255,0.92))",
    fillCool: "linear-gradient(160deg, rgba(120,132,220,0.14), rgba(255,255,255,0.92))",
    fallbackFill: "rgba(255,255,255,0.96)",
    chromeFill: "rgba(255,255,255,0.82)",
    edge: "rgba(29,27,38,0.06)",
    sheen: "rgba(255,255,255,0.9)",
    blur: 24,
    saturate: 1.4,
    chromeBlur: 28,
    nativeIntensity: 60,
    nativeTint: "light",
  },
  charcoal: {
    fill: "linear-gradient(160deg, #3A3C43, #2F3136)",
    fillLit: "linear-gradient(160deg, #42444C, #34363C)",
    fillWarm: "linear-gradient(160deg, rgba(245,154,69,0.18), #2F3136)",
    fillCool: "linear-gradient(160deg, rgba(242,211,166,0.14), #2F3136)",
    fallbackFill: "rgba(48,50,56,0.97)",
    chromeFill: "rgba(34,35,39,0.88)",
    edge: "rgba(255,255,255,0.09)",
    sheen: "rgba(255,255,255,0.14)",
    blur: 24,
    saturate: 1.4,
    chromeBlur: 28,
    nativeIntensity: 50,
    nativeTint: "dark",
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
    { color: "#9AA6EC", x: 10, y: 0, size: 85, opacity: 0.55 },
    { color: "#FFB27A", x: 100, y: 55, size: 65, opacity: 0.45 },
    { color: "#C9D0F5", x: 40, y: 100, size: 70, opacity: 0.4 },
  ],
  charcoal: [
    { color: "#F59A45", x: 100, y: 0, size: 70, opacity: 0.16 },
    { color: "#8A8C94", x: 0, y: 30, size: 60, opacity: 0.12 },
    { color: "#F07D28", x: 50, y: 105, size: 60, opacity: 0.12 },
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

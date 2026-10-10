// AutoDeck experience palette (docs/22-experience-migration-spec.md §3.1).
//
// The room is a cool near-black. One warm light falls on it: amber, the
// studio working, and champagne, its cooled reflection. Colour carries
// information; the only ornament is light (the ambient field and the glass
// sheen). Components consume these roles, never raw hex.

export interface ThemeColors {
  canvas: string;
  canvasDeep: string;
  surface: string;
  surfaceElevated: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;
  accent: string;
  accentStrong: string;
  accentHaze: string;
  premium: string;
  premiumHaze: string;
  success: string;
  warning: string;
  danger: string;
  inactive: string;
  scrim: string;
  /** Deep navy chrome: floating nav, hero cards. */
  ink: string;
  onInk: string;
}

export const darkColors: ThemeColors = {
  canvas: "#08090A",
  canvasDeep: "#0A0B0D",
  surface: "#15161A",
  surfaceElevated: "#1E2024",
  borderSubtle: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(245,246,247,0.22)",
  textPrimary: "#EDEBE7",
  textSecondary: "#ADACA9",
  textTertiary: "#91918F",
  textOnAccent: "#1D1B26",
  accent: "#F27A1A",
  accentStrong: "#F59A45",
  accentHaze: "rgba(242,122,26,0.18)",
  premium: "#E8D9BE",
  premiumHaze: "rgba(232,217,190,0.12)",
  success: "#E8D9BE",
  warning: "#E0A45C",
  danger: "#E2705A",
  inactive: "#8A8F96",
  scrim: "rgba(12,13,14,0.40)",
  ink: "#1E2024",
  onInk: "#EDEBE7",
};

// Soft lavender-to-peach gradient ground, white cards, light frosted chrome, AutoDeck orange.
// (Owner reference, Oct 1 2026: light gradient surfaces, floating navy nav,
// blue swapped for orange.)
export const lightColors: ThemeColors = {
  canvas: "#ECEBF8",
  canvasDeep: "#D6DBF1",
  surface: "#FFFFFF",
  surfaceElevated: "#F2F4FC",
  borderSubtle: "rgba(29,27,38,0.08)",
  borderStrong: "rgba(29,27,38,0.24)",
  textPrimary: "#1D1B26",
  textSecondary: "#4A4655",
  textTertiary: "#625D70",
  textOnAccent: "#FFFFFF",
  accent: "#C2540A",
  accentStrong: "#9C4108",
  accentHaze: "rgba(242,122,26,0.14)",
  premium: "#9A5A12",
  premiumHaze: "rgba(242,122,26,0.10)",
  success: "#1F7A4D",
  warning: "#8A5A00",
  danger: "#B93838",
  inactive: "#6B6E85",
  scrim: "rgba(29,27,38,0.36)",
  ink: "#FFFFFF",
  onInk: "#1D1B26",
};

// Night mode (all three apps). Anchored on Asian Paints 8301 Coal Mine
// (#50504D): that is the page ground; cards step darker so text and the
// orange keep WCAG contrast. The orange accent is the same in both modes.
export const nightColors: ThemeColors = {
  canvas: "#50504D",
  canvasDeep: "#3A3A38",
  surface: "#373735",
  surfaceElevated: "#42423F",
  borderSubtle: "rgba(255,255,255,0.14)",
  borderStrong: "rgba(255,255,255,0.34)",
  textPrimary: "#FAF8F5",
  textSecondary: "#E2E0DC",
  textTertiary: "#CDCBC6",
  textOnAccent: "#1A1410",
  accent: "#EC8638",
  accentStrong: "#F59A4E",
  accentHaze: "rgba(236,134,56,0.20)",
  premium: "#F2D3A6",
  premiumHaze: "rgba(242,211,166,0.14)",
  success: "#7DDBAA",
  warning: "#F2B95E",
  danger: "#FF9684",
  inactive: "#C4C2BD",
  scrim: "rgba(0,0,0,0.55)",
  ink: "#2E2E2C",
  onInk: "#FAF8F5",
};

export type ThemeName = "dark" | "light" | "night";
export const themeColors: Record<ThemeName, ThemeColors> = { dark: darkColors, light: lightColors, night: nightColors };

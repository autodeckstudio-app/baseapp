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
  textOnAccent: "#100C06",
  accent: "#E0A45C",
  accentStrong: "#F0C48C",
  accentHaze: "rgba(224,164,92,0.14)",
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

// Soft lavender ground, white cards, deep navy chrome, AutoDeck orange.
// (Owner reference, Oct 1 2026: light gradient surfaces, floating navy nav,
// blue swapped for orange.)
export const lightColors: ThemeColors = {
  canvas: "#E7EAF7",
  canvasDeep: "#D6DBF1",
  surface: "#FFFFFF",
  surfaceElevated: "#F2F4FC",
  borderSubtle: "rgba(11,16,51,0.08)",
  borderStrong: "rgba(11,16,51,0.24)",
  textPrimary: "#0B1033",
  textSecondary: "#383E63",
  textTertiary: "#525979",
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
  scrim: "rgba(11,16,51,0.36)",
  ink: "#0B1033",
  onInk: "#F4F5FB",
};

export type ThemeName = "dark" | "light";
export const themeColors: Record<ThemeName, ThemeColors> = { dark: darkColors, light: lightColors };

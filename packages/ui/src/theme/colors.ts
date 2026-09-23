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
};

// Porcelain + bronze. The bronze accent is provisional until checked
// against the AutoDeck brand orange (spec §3.1 "Adapt").
export const lightColors: ThemeColors = {
  canvas: "#F7F7F6",
  canvasDeep: "#EFEFED",
  surface: "#FFFFFF",
  surfaceElevated: "#F4F4F3",
  borderSubtle: "rgba(20,21,23,0.08)",
  borderStrong: "rgba(20,21,23,0.22)",
  textPrimary: "#141517",
  textSecondary: "#45464A",
  textTertiary: "#5E5F63",
  textOnAccent: "#FFFFFF",
  accent: "#7A521E",
  accentStrong: "#5E3F16",
  accentHaze: "rgba(122,82,30,0.10)",
  premium: "#7A521E",
  premiumHaze: "rgba(122,82,30,0.08)",
  success: "#1F7A4D",
  warning: "#8A6512",
  danger: "#B93838",
  inactive: "#6B6E73",
  scrim: "rgba(12,13,14,0.32)",
};

export type ThemeName = "dark" | "light";
export const themeColors: Record<ThemeName, ThemeColors> = { dark: darkColors, light: lightColors };

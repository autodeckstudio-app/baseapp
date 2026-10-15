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

// Night: Coal Mine anchor with a lighter gradient ground and raised tonal cards.
export const nightColors: ThemeColors = {
  canvas: "#50504D",
  canvasDeep: "#3A3A38",
  surface: "#484845",
  surfaceElevated: "#575752",
  borderSubtle: "rgba(255,255,255,0.14)",
  borderStrong: "rgba(255,255,255,0.34)",
  textPrimary: "#FAF8F5",
  textSecondary: "#F4F2ED",
  textTertiary: "#F0EEE8",
  textOnAccent: "#1A1410",
  accent: "#EC8638",
  accentStrong: "#F59A4E",
  accentHaze: "rgba(236,134,56,0.20)",
  premium: "#F2D3A6",
  premiumHaze: "rgba(242,211,166,0.14)",
  success: "#7DDBAA",
  warning: "#F2B95E",
  danger: "#FFBAAD",
  inactive: "#C4C2BD",
  scrim: "rgba(0,0,0,0.55)",
  ink: "#2E2E2C",
  onInk: "#FAF8F5",
};

export type ThemeName = "dark" | "light" | "night";
export const themeColors: Record<ThemeName, ThemeColors> = { dark: darkColors, light: lightColors, night: nightColors };

/** Customer app only: same near-black palette as tokens applyCustomerDark, applied to the role-based theme. */
export function applyCustomerDarkTheme(): void {
  const dark: Partial<ThemeColors> = {
    canvas: "#0B0B0C", canvasDeep: "#070708", surface: "#161618", surfaceElevated: "#202023",
    borderSubtle: "rgba(255,255,255,0.09)", borderStrong: "rgba(255,255,255,0.24)",
    textPrimary: "#F5F3EF", textSecondary: "#C4C1BC", textTertiary: "#9A9792", textOnAccent: "#1A1410",
    accent: "#EC8638", accentStrong: "#F59A4E", accentHaze: "rgba(236,134,56,0.20)",
    inactive: "#8A8884", scrim: "rgba(0,0,0,0.62)", ink: "#202023", onInk: "#F5F3EF",
  };
  Object.assign(nightColors, dark);
  Object.assign(lightColors, dark);
  Object.assign(darkColors, dark);
}

/** Customer app "Raised" palette: soft grey day, deep charcoal night, raised cards, the one AutoDeck orange. */
export function applyCustomerRaisedTheme(): void {
  Object.assign(lightColors, {
    canvas: "#E8EAED", canvasDeep: "#DCDFE4", surface: "#F3F4F6", surfaceElevated: "#FAFBFC",
    borderSubtle: "rgba(20,22,26,0.07)", borderStrong: "rgba(20,22,26,0.22)",
    textPrimary: "#16181C", textSecondary: "#4B5058", textTertiary: "#626871", textOnAccent: "#1A1410",
    accent: "#EC8638", accentStrong: "#B8500A", accentHaze: "rgba(236,134,56,0.16)",
    inactive: "#9AA0A8", scrim: "rgba(20,22,26,0.40)", ink: "#16181C", onInk: "#FFFFFF",
  } satisfies Partial<ThemeColors>);
  const night: Partial<ThemeColors> = {
    canvas: "#0F1013", canvasDeep: "#09090B", surface: "#1A1C20", surfaceElevated: "#24272C",
    borderSubtle: "rgba(255,255,255,0.07)", borderStrong: "rgba(255,255,255,0.24)",
    textPrimary: "#F3F1ED", textSecondary: "#BEBCB7", textTertiary: "#8F8D89", textOnAccent: "#1A1410",
    accent: "#EC8638", accentStrong: "#F59A4E", accentHaze: "rgba(236,134,56,0.20)",
    inactive: "#8A8884", scrim: "rgba(0,0,0,0.62)", ink: "#F3F1ED", onInk: "#16181C",
  };
  Object.assign(nightColors, night);
  Object.assign(darkColors, night);
}

// AutoDeck colour tokens - light lavender ground, white cards and one orange accent.
// Amber is reserved for primary actions, the active state and price
// emphasis - never used to flood the UI.
//
import { currentMode } from "../theme/autoMode.js";

// Pure values only (no react-native/DOM imports) so this file is safe to
// import from any app, including the web admin.
const dayColors = {
  // Mobile components share the experience palette (theme/colors.ts): the
  // dark studio ground, amber light and champagne reflection. Kept under the
  // legacy role names so every existing screen picks it up.
  // Surfaces
  background: "#F4F3F0", // the room: cool near-black
  surface: "rgba(255,255,255,0.86)", // flat pane for rows/cards (glass is the raised one)
  surfaceElevated: "#F2F4FC", // sheets, modals
  surfaceSunken: "#F6F5FC", // inputs, recessed wells

  // Text
  textPrimary: "#1D1B26",
  textSecondary: "#4A4655",
  textMuted: "#625D70",
  textOnAccent: "#FFFFFF",

  // Structure
  border: "rgba(29,27,38,0.12)",
  borderStrong: "rgba(29,27,38,0.24)",
  divider: "rgba(29,27,38,0.08)",

  // Accent - amber, one warm light
  accent: "#C2540A",
  accentPressed: "#9C4108",
  accentMuted: "rgba(242,122,26,0.14)",

  // Status
  success: "#1F7A4D", // champagne: done, verified
  successMuted: "rgba(31,122,77,0.12)",
  warning: "#8A5A00",
  warningMuted: "rgba(138,90,0,0.12)",
  error: "#B93838",
  errorMuted: "rgba(185,56,56,0.12)",
  info: "#2F5FA3",
  infoMuted: "rgba(47,95,163,0.12)",

  // Fixed
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(29, 27, 38, 0.36)", // modal/sheet backdrop
} as const;

type Palette = { [K in keyof typeof dayColors]: string };

// Night: Coal Mine (#50504D) ground, darker cards, the same orange accent.
const nightPalette: Palette = {
  background: "#50504D",
  surface: "#484845",
  surfaceElevated: "#575752",
  surfaceSunken: "#2E2E2C",
  textPrimary: "#FAF8F5",
  textSecondary: "#F4F2ED",
  textMuted: "#F0EEE8",
  textOnAccent: "#1A1410",
  border: "rgba(255,255,255,0.16)",
  borderStrong: "rgba(255,255,255,0.34)",
  divider: "rgba(255,255,255,0.12)",
  accent: "#EC8638",
  accentPressed: "#F59A4E",
  accentMuted: "rgba(236,134,56,0.22)",
  success: "#7DDBAA",
  successMuted: "rgba(125,219,170,0.16)",
  warning: "#F2B95E",
  warningMuted: "rgba(242,185,94,0.16)",
  error: "#FFBAAD",
  errorMuted: "rgba(255,150,132,0.16)",
  info: "#8DB7F0",
  infoMuted: "rgba(141,183,240,0.16)",
  white: "#1A1410", // only used for text on an accent fill, so it flips to dark ink
  black: "#000000",
  overlay: "rgba(0,0,0,0.55)",
};

/** Day palette (the bright light theme) or night palette, fixed when the app loads; the studio app reloads itself when day flips to night. */
export const colors: Palette = currentMode() === "night" ? nightPalette : dayColors;
export const isNightPalette = colors === nightPalette;

export type ColorToken = keyof Palette;

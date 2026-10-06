// AutoDeck colour tokens - light lavender ground, white cards and one orange accent.
// Amber is reserved for primary actions, the active state and price
// emphasis - never used to flood the UI.
//
// Pure values only (no react-native/DOM imports) so this file is safe to
// import from any app, including the web admin.
export const colors = {
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

export type ColorToken = keyof typeof colors;

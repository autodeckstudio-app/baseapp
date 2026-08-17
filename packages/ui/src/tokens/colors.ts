// AutoDeck colour tokens — premium automotive technology, not a generic SaaS
// palette. Foundation is white / graphite / charcoal / soft grey; orange is
// a restrained accent reserved for primary actions, important status,
// selected states, and price emphasis — never used to flood the UI.
//
// Pure values only (no react-native/DOM imports) so this file is safe to
// import from any app, including the web admin.
export const colors = {
  // Surfaces
  background: "#F6F6F7", // page/app background — soft grey
  surface: "#FFFFFF", // card/row background — white, sits on top of background
  surfaceElevated: "#FFFFFF", // modal/sheet background — white, stronger elevation
  surfaceSunken: "#EFEFF1", // recessed areas (e.g. input backgrounds)

  // Text
  textPrimary: "#1C1C1E", // charcoal — headings, primary content
  textSecondary: "#48484C", // graphite — secondary content
  textMuted: "#8A8A8E", // soft grey — captions, placeholders, disabled
  textOnAccent: "#FFFFFF", // text/icons on top of the accent colour

  // Structure
  border: "#E2E2E5",
  borderStrong: "#C9C9CD",
  divider: "#EBEBED",

  // Accent — restrained orange
  accent: "#D2571F",
  accentPressed: "#AE481A",
  accentMuted: "#FBE6D9", // tint for selected-state backgrounds, chips

  // Status
  success: "#1F8A5F",
  successMuted: "#E1F3EA",
  warning: "#B87A12",
  warningMuted: "#FBF0DD",
  error: "#C6392C",
  errorMuted: "#FBE6E3",
  info: "#2F6FB0",
  infoMuted: "#E4EFF8",

  // Fixed
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(20, 20, 22, 0.5)", // modal/sheet backdrop
} as const;

export type ColorToken = keyof typeof colors;

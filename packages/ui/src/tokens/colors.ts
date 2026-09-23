// AutoDeck colour tokens — dark studio ground with one warm amber light.
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
  background: "#08090A", // the room: cool near-black
  surface: "#15161A", // flat pane for rows/cards (glass is the raised one)
  surfaceElevated: "#1E2024", // sheets, modals
  surfaceSunken: "#0E0F12", // inputs, recessed wells

  // Text
  textPrimary: "#EDEBE7",
  textSecondary: "#ADACA9",
  textMuted: "#91918F",
  textOnAccent: "#100C06",

  // Structure
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(245,246,247,0.22)",
  divider: "rgba(255,255,255,0.06)",

  // Accent — amber, one warm light
  accent: "#E0A45C",
  accentPressed: "#C98A40",
  accentMuted: "rgba(224,164,92,0.14)",

  // Status
  success: "#E8D9BE", // champagne: done, verified
  successMuted: "rgba(232,217,190,0.12)",
  warning: "#E0A45C",
  warningMuted: "rgba(224,164,92,0.14)",
  error: "#E2705A",
  errorMuted: "rgba(226,112,90,0.14)",
  info: "#8FB3D9",
  infoMuted: "rgba(143,179,217,0.12)",

  // Fixed
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(4, 5, 6, 0.64)", // modal/sheet backdrop
} as const;

export type ColorToken = keyof typeof colors;

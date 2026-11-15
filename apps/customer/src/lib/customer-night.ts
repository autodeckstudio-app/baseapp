import { colors, isNightPalette } from "@autodeck/ui/tokens";
import { nightColors, darkColors } from "@autodeck/ui/theme";
/** Customer-only override. Staff palettes and the white day palette are not changed. */
export const customerNight = {
  canvas: "#24262A",
  canvasDeep: "#202226",
  surface: "#303338",
  surfaceElevated: "#35383D",
  borderSubtle: "rgba(239,232,221,0.14)",
  borderStrong: "rgba(239,232,221,0.28)",
  textPrimary: "#EEEAE4",
  textSecondary: "#CCC6BD",
  textTertiary: "#B7B0A6",
  textOnAccent: "#231E18",
  accent: "#EC8638",
  accentStrong: "#F59A4E",
  accentHaze: "rgba(236,134,56,0.16)",
  premium: "#D5BE9E",
  premiumHaze: "rgba(213,190,158,0.12)",
  inactive: "#AAA49A",
  scrim: "rgba(15,17,20,0.58)",
  ink: "#393D42",
  onInk: "#EEEAE4",
};
export const nightAction = {
  background: "#B9A58C",
  text: "#231E18",
  selected: "#665A4B",
  selectedText: "#F5EDE2",
};
export function applyCustomerSoftNight() {
  Object.assign(nightColors, customerNight);
  Object.assign(darkColors, customerNight);
  if (isNightPalette)
    Object.assign(colors, {
      background: customerNight.canvas,
      surface: customerNight.surface,
      surfaceElevated: customerNight.surfaceElevated,
      surfaceSunken: "#292C30",
      textPrimary: customerNight.textPrimary,
      textSecondary: customerNight.textSecondary,
      textMuted: customerNight.textTertiary,
      textOnAccent: customerNight.textOnAccent,
      border: customerNight.borderSubtle,
      borderStrong: customerNight.borderStrong,
      divider: customerNight.borderSubtle,
      accent: customerNight.accent,
      accentPressed: customerNight.accentStrong,
      accentMuted: customerNight.accentHaze,
      overlay: customerNight.scrim,
    });
}

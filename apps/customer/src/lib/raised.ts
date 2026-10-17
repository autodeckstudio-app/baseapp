// "Raised" surfaces for the customer app: soft cards that sit on the ground
// with a light and a dark shadow (day), or a deep shadow and a faint rim
// (night). Orange is the only colour fill. One recipe per theme so every page
// matches. Use raised(name) with the name from useExperienceTheme().
import { Platform, type ViewStyle } from "react-native";
import { lightColors, nightColors, DAY_ATMOSPHERE } from "@autodeck/ui/theme";

const web = Platform.OS === "web";
export type Mode = "light" | "night" | "dark";
const isNight = (m: Mode) => m !== "light";

export type Raised = {
  card: ViewStyle;
  well: ViewStyle;
  round: ViewStyle;
  roundOn: ViewStyle;
  primary: ViewStyle;
  quiet: ViewStyle;
  dark: ViewStyle;
  sheet: ViewStyle;
  ground: string;
  groundImage: string;
};

const SH = {
  light: {
    card: "0 10px 28px rgba(70,55,40,0.12), 0 1px 3px rgba(70,55,40,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
    small: "0 6px 16px rgba(70,55,40,0.12), 0 1px 2px rgba(70,55,40,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
    well: "inset 0 2px 6px rgba(70,55,40,0.14)",
  },
  night: {
    card: "12px 16px 30px rgba(0,0,0,0.60), -6px -6px 18px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.07)",
    small: "7px 9px 18px rgba(0,0,0,0.58), -4px -4px 12px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.07)",
    well: "inset 6px 7px 14px rgba(0,0,0,0.55), inset -4px -4px 10px rgba(255,255,255,0.04)",
  },
};

export function raised(mode: Mode): Raised {
  const night = isNight(mode);
  const c = night ? nightColors : { ...lightColors, surface: "#FFFFFF", surfaceElevated: "#F7F6F3", canvas: "#F3F2EF" };
  const s = night ? SH.night : SH.light;
  // One dark card colour everywhere (the same charcoal as Home and Garage), never the theme palette grey.
  const surf = night ? "#1B1B1F" : c.surface;
  const surfElevated = night ? "#232328" : c.surfaceElevated;
  const native = (elev: number): ViewStyle => ({ shadowColor: "#000", shadowOpacity: night ? 0.5 : 0.18, shadowRadius: elev * 1.6, shadowOffset: { width: 0, height: elev }, elevation: elev });
  const grad = (a: string, b: string) => (web ? ({ backgroundImage: `linear-gradient(145deg, ${a}, ${b})` } as object) : {});
  return {
    card: { backgroundColor: surf, borderRadius: 24, ...(web ? ({ boxShadow: s.card, ...grad(night ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0)", night ? "rgba(255,255,255,0.0)" : "rgba(255,255,255,0.0)") } as object) : native(8)) },
    well: { backgroundColor: night ? "#131417" : "#E9E2D7", borderRadius: 16, ...(web ? ({ boxShadow: s.well } as object) : {}) },
    round: { backgroundColor: surf, borderRadius: 999, ...(web ? ({ boxShadow: s.small, ...grad(night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0)", "rgba(255,255,255,0)") } as object) : native(5)) },
    roundOn: { backgroundColor: "#EC8638", borderRadius: 999, ...(web ? ({ boxShadow: "0 10px 22px -6px rgba(236,134,56,0.65), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -6px 10px rgba(160,70,10,0.25)", backgroundImage: "linear-gradient(180deg, #F7A257, #EC8638 55%, #D9712A)" } as object) : native(6)) },
    primary: { backgroundColor: "rgba(236,134,56,0.88)", ...(web ? ({ boxShadow: "0 6px 14px -8px rgba(236,134,56,0.5), inset 0 1px 0 rgba(255,255,255,0.35)" } as object) : native(3)) },
    quiet: { backgroundColor: surf, ...(web ? ({ boxShadow: s.small } as object) : native(4)) },
    dark: { backgroundColor: night ? "#F3F1ED" : "#16181C", ...(web ? ({ boxShadow: night ? "0 10px 22px -8px rgba(0,0,0,0.7)" : "0 12px 22px -8px rgba(22,24,28,0.55), inset 0 1px 0 rgba(255,255,255,0.18)" } as object) : native(6)) },
    sheet: { backgroundColor: surfElevated, borderRadius: 24, ...(web ? ({ boxShadow: s.card } as object) : native(10)) },
    ground: c.canvas,
    groundImage: night
      ? "radial-gradient(120% 50% at 80% -10%, rgba(236,134,56,0.10) 0%, rgba(236,134,56,0) 60%), linear-gradient(180deg, #14151A 0%, #0F1013 60%, #0B0B0E 100%)"
      : DAY_ATMOSPHERE,
  };
}

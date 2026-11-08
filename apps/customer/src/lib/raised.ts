// "Raised" surfaces for the customer app: soft cards that sit on the ground
// with a light and a dark shadow (day), or a deep shadow and a faint rim
// (night). Orange is the only colour fill. One recipe per theme so every page
// matches. Use raised(name) with the name from useExperienceTheme().
import { Platform, type ViewStyle } from "react-native";
import { lightColors, nightColors } from "@autodeck/ui/theme";

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
    card: "12px 16px 30px rgba(0,0,0,0.22), -6px -6px 18px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.07)",
    small: "7px 9px 18px rgba(0,0,0,0.20), -4px -4px 12px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.07)",
    well: "inset 6px 7px 14px rgba(0,0,0,0.20), inset -4px -4px 10px rgba(255,255,255,0.04)",
  },
};

export function raised(mode: Mode): Raised {
  const night = isNight(mode);
  const c = night ? nightColors : { ...lightColors, surface: "#FFFFFF", surfaceElevated: "#F7F6F3", canvas: "#FFFFFF" };
  const s = night ? SH.night : SH.light;
  // One dark card colour everywhere (the same charcoal as Home and Garage), never the theme palette grey.
  const surf = c.surface;
  const surfElevated = c.surfaceElevated;
  const native = (elev: number): ViewStyle => ({ shadowColor: "#000", shadowOpacity: night ? 0.5 : 0.18, shadowRadius: elev * 1.6, shadowOffset: { width: 0, height: elev }, elevation: elev });
  const grad = (a: string, b: string) => (web ? ({ backgroundImage: `linear-gradient(145deg, ${a}, ${b})` } as object) : {});
  return {
    card: { backgroundColor: night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)", borderRadius: 24, borderWidth: 1, borderColor: night ? "rgba(255,255,255,0.09)" : "rgba(20,22,26,0.07)", ...(web ? ({ boxShadow: night ? "0 18px 42px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)" : s.card, ...grad(night ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.0)", "rgba(255,255,255,0)"), backdropFilter: "blur(22px) saturate(150%)", WebkitBackdropFilter: "blur(22px) saturate(150%)" } as object) : native(8)) },
    well: { backgroundColor: night ? "#292C30" : "#E9E2D7", borderRadius: 16, ...(web ? ({ boxShadow: s.well } as object) : {}) },
    round: { backgroundColor: surf, borderRadius: 999, ...(web ? ({ boxShadow: s.small, ...grad(night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0)", "rgba(255,255,255,0)") } as object) : native(5)) },
    roundOn: { backgroundColor: "#EC8638", borderRadius: 999, ...(web ? ({ boxShadow: "0 10px 22px -6px rgba(236,134,56,0.65), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -6px 10px rgba(160,70,10,0.25)", backgroundImage: "linear-gradient(180deg, #F7A257, #EC8638 55%, #D9712A)" } as object) : native(6)) },
    primary: { backgroundColor: "rgba(236,134,56,0.88)", ...(web ? ({ boxShadow: "0 6px 14px -8px rgba(236,134,56,0.5), inset 0 1px 0 rgba(255,255,255,0.35)" } as object) : native(3)) },
    quiet: { backgroundColor: night ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.66)", borderRadius: 999, borderWidth: 1, borderColor: night ? "rgba(255,255,255,0.08)" : "rgba(20,22,26,0.06)", ...(web ? ({ boxShadow: night ? "0 8px 20px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)" : s.small, backdropFilter: "blur(18px) saturate(140%)", WebkitBackdropFilter: "blur(18px) saturate(140%)" } as object) : native(4)) },
    dark: { backgroundColor: night ? "#B9A58C" : "#16181C", ...(web ? ({ boxShadow: night ? "0 10px 22px -8px rgba(0,0,0,0.7)" : "0 12px 22px -8px rgba(22,24,28,0.55), inset 0 1px 0 rgba(255,255,255,0.18)" } as object) : native(6)) },
    sheet: { backgroundColor: night ? "rgba(27,29,32,0.82)" : "rgba(255,255,255,0.88)", borderRadius: 24, borderWidth: 1, borderColor: night ? "rgba(255,255,255,0.10)" : "rgba(20,22,26,0.06)", ...(web ? ({ boxShadow: s.card, backdropFilter: "blur(28px) saturate(150%)", WebkitBackdropFilter: "blur(28px) saturate(150%)" } as object) : native(10)) },
    ground: c.canvas,
    groundImage: night
      ? "radial-gradient(110% 46% at 50% -8%, rgba(236,134,56,0.15) 0%, rgba(236,134,56,0) 62%), radial-gradient(90% 40% at 85% 108%, rgba(236,134,56,0.05) 0%, rgba(236,134,56,0) 60%), linear-gradient(180deg, #27292D 0%, #212326 55%, #1C1E21 100%)"
      : "radial-gradient(100% 42% at 50% 0%, rgba(236,134,56,0.05) 0%, transparent 70%), linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%)",
  };
}

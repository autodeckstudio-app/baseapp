// "Garage Light" surfaces for the customer app. Cards are solid with a soft shadow and no border.
// Glass is kept only for floating chrome (tab bar, sheet headers): see glassChrome.
// The names stay (glassSurface etc.) so every screen picks the new look up.
import { Platform, type ViewStyle } from "react-native";
import { isNightPalette } from "@autodeck/ui/tokens";

const web = Platform.OS === "web";
const night = isNightPalette;

const CARD = night ? "#2A2A29" : "#FFFFFF";
const SHADOW = night ? "0 10px 28px -14px rgba(0,0,0,0.55)" : "0 8px 24px -12px rgba(40,30,20,0.16)";

/** Panels, cards, rows, search bar: solid, borderless, soft shadow. */
export const glassSurface: ViewStyle = {
  backgroundColor: CARD,
  ...(web ? ({ boxShadow: SHADOW } as object) : { elevation: 2, shadowColor: "#000", shadowOpacity: night ? 0.3 : 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }),
};

/** Chips and inner tiles sitting on a card: a quiet tint, no outline. */
export const glassInner: ViewStyle = {
  backgroundColor: night ? "rgba(255,255,255,0.06)" : "rgba(27,26,25,0.045)",
};

/** Primary action: glossy orange (one per screen). */
export const glassOrange: ViewStyle = {
  backgroundColor: "#E8742A",
  ...(web
    ? ({
        backgroundImage: "linear-gradient(180deg, #F08A45 0%, #E8742A 52%, #D4651C 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 18px -8px rgba(232,116,42,0.55)",
      } as object)
    : {}),
};

/** Secondary action: a solid tinted button, no outline. */
export const glassQuiet: ViewStyle = {
  backgroundColor: night ? "rgba(255,255,255,0.09)" : "rgba(27,26,25,0.06)",
};

/** Floating chrome over photos (tab bar, sheet headers): the only place glass is used. */
export const glassChrome: ViewStyle = {
  backgroundColor: night ? "rgba(42,42,41,0.78)" : "rgba(255,255,255,0.78)",
  ...(web
    ? ({
        backdropFilter: "blur(22px) saturate(140%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
        boxShadow: night ? "0 10px 30px -12px rgba(0,0,0,0.6)" : "0 10px 30px -12px rgba(40,30,20,0.22)",
      } as object)
    : {}),
};

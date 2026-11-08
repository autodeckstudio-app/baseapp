import { Platform, type ViewStyle } from "react-native";

/**
 * A translucent glass pane: soft gradient, hairline edge, top highlight and, on web, a real backdrop blur.
 * The gradient is dense enough to stay legible where blur is unsupported, so it is also the fallback.
 */
export function glassPane(light = false): ViewStyle {
  // Day: a warm off-white card with a soft edge and shadow. Never the dark glass, which turns muddy grey on the day ground.
  if (light) {
    return {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(60,48,36,0.10)",
      backgroundColor: "rgba(255,255,255,0.74)",
      ...(Platform.OS === "web" ? ({ boxShadow: "0 10px 28px rgba(70,55,40,0.12), 0 1px 3px rgba(70,55,40,0.08), inset 0 1px 0 rgba(255,255,255,0.7)", backdropFilter: "blur(18px) saturate(140%)", WebkitBackdropFilter: "blur(18px) saturate(140%)" } as object) : { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }),
    };
  }
  if (Platform.OS !== "web") {
    return { backgroundColor: "rgba(48,51,56,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 24 };
  }
  return {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    backgroundColor: "rgba(40,43,47,0.52)",
    ...({
      backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02))",
      backdropFilter: "blur(22px) saturate(150%)",
      WebkitBackdropFilter: "blur(22px) saturate(150%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 12px 32px rgba(0,0,0,0.30)",
    } as object),
  };
}

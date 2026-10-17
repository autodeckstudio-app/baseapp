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
      backgroundColor: "#FFFFFF",
      ...(Platform.OS === "web" ? ({ boxShadow: "0 10px 28px rgba(70,55,40,0.12), 0 1px 3px rgba(70,55,40,0.08), inset 0 1px 0 rgba(255,255,255,0.7)" } as object) : { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }),
    };
  }
  if (Platform.OS !== "web") {
    return { backgroundColor: "rgba(28,28,32,0.78)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 24 };
  }
  return {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(24,24,28,0.62)",
    ...({
      backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.13), rgba(255,255,255,0.03))",
      backdropFilter: "blur(20px) saturate(140%)",
      WebkitBackdropFilter: "blur(20px) saturate(140%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 30px rgba(0,0,0,0.35)",
    } as object),
  };
}

import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** A soft lamp glow from the top of the page, neutral with a faint warm core, no photo. The header reads on the page ground in Day and Night alike. */
export const BACKDROP_FADE = "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.55) 55%, transparent 100%)";

export function HomeBackdrop() {
  const { name } = useExperienceTheme();
  const glow = name === "light" ? "rgba(255,178,122,0.16)" : "rgba(255,255,255,0.07)";
  const warm = name === "light" ? "rgba(255,178,122,0.10)" : "rgba(255,170,110,0.05)";
  const fade = { maskImage: BACKDROP_FADE, WebkitMaskImage: BACKDROP_FADE } as object;
  return (
    <View pointerEvents="none" style={{ ...({ position: "fixed" } as object), top: 0, left: 0, right: 0, height: 320, zIndex: -1, ...fade }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: `radial-gradient(70% 60% at 50% 0%, ${warm} 0%, transparent 70%), radial-gradient(120% 90% at 50% 0%, ${glow} 0%, transparent 70%)` } as object) }} />
    </View>
  );
}

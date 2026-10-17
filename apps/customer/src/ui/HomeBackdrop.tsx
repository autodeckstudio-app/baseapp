import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** Real studio photo from the brand set, faded into the page so the glass panes have something to blur. */
export const HOME_BACKDROP_PHOTO = "/hero-studio.jpg";

export function HomeBackdrop() {
  const { name } = useExperienceTheme();
  const day = name === "light";
  // Day: the photo dissolves into the shared Day background with a mask, not a flat colour, so the page reads as one surface.
  const end = day ? "rgba(10,10,12,0.8)" : "#0b0b0d";
  const fade = day ? ({ maskImage: "linear-gradient(180deg, #000 52%, transparent 100%)", WebkitMaskImage: "linear-gradient(180deg, #000 52%, transparent 100%)" } as object) : null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: -140, left: -20, right: -20, height: 520, overflow: "hidden", zIndex: -1, ...fade }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: `url(${HOME_BACKDROP_PHOTO})`, backgroundSize: "cover", backgroundPosition: "center" } as object) }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: `linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.78) 40%, ${end} 100%)` } as object) }} />
    </View>
  );
}

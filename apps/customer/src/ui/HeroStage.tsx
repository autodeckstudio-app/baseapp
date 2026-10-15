import { Image, Platform, Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { metrics } from "../lib/metrics";

export type StageCar = { id: string; title: string; plate: string; photo?: string | null; hasPhoto?: boolean };

const BG = "#0b0b0d";
const web = Platform.OS === "web";
const glow = web ? ({ backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(236,134,56,0.46) 0%, rgba(236,134,56,0.16) 45%, rgba(236,134,56,0) 72%)" } as object) : { backgroundColor: "rgba(236,134,56,0.10)" };
// Customer photos are not cutouts, so the photo is feathered into the page instead of boxed.
const feather = web ? ({ WebkitMaskImage: "radial-gradient(ellipse 72% 68% at 50% 46%, #000 52%, transparent 100%)", maskImage: "radial-gradient(ellipse 72% 68% at 50% 46%, #000 52%, transparent 100%)" } as object) : {};

/** The customer's car as the hero: floating on black with a soft orange glow beneath. */
export function HeroStage({ car, onOpen }: { car: StageCar; onOpen: () => void }) {
  const day = useExperienceTheme().name === "light";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${car.title}, ${car.photo ? "care map" : "add a photo"}`} onPress={onOpen} style={{ height: metrics.heroStage, alignItems: "center", justifyContent: "flex-end", overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: "6%", right: "6%", bottom: 28, height: 150, borderRadius: 9999, ...glow }} />
      {car.photo ? (
        <Image source={{ uri: car.photo }} resizeMode="cover" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 52, ...feather } as object} />
      ) : null}
      <View style={{ alignItems: "center", gap: 6, paddingBottom: metrics.innerGap }}>
        <Text numberOfLines={1} style={{ color: day ? "#1D1B26" : "#FFFFFF", fontSize: 24, fontWeight: "800", textAlign: "center" }}>{car.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: day ? "#5B5750" : "#C9C6C1", fontSize: 13, fontWeight: "700", letterSpacing: 2 }}>{car.plate}</Text>
          {!car.photo ? <View style={{ borderRadius: 9999, borderWidth: 1, borderColor: day ? "rgba(29,27,38,0.30)" : "rgba(255,255,255,0.28)", paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: day ? "#1D1B26" : "#F4F2EF", fontSize: 12, fontWeight: "700" }}>Add your car photo</Text></View> : null}
        </View>
      </View>
    </Pressable>
  );
}
export { BG as HERO_BG };

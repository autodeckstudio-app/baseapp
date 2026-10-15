import { Image, Platform, Pressable, Text, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import { metrics } from "../lib/metrics";

export type StageCar = { id: string; title: string; plate: string; photo?: string | null; hasPhoto?: boolean };

const BG = "#0b0b0d";
const web = Platform.OS === "web";
const glow = web ? ({ backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(236,134,56,0.30) 0%, rgba(236,134,56,0.10) 45%, rgba(236,134,56,0) 72%)" } as object) : { backgroundColor: "rgba(236,134,56,0.10)" };
// Customer photos are not cutouts, so the photo is feathered into the page instead of boxed.
const feather = web ? ({ WebkitMaskImage: "radial-gradient(ellipse 72% 68% at 50% 46%, #000 52%, transparent 100%)", maskImage: "radial-gradient(ellipse 72% 68% at 50% 46%, #000 52%, transparent 100%)" } as object) : {};

/** The customer's car as the hero: floating on black with a soft orange glow beneath. */
export function HeroStage({ car, onOpen }: { car: StageCar; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${car.title}, ${car.photo ? "care map" : "add a photo"}`} onPress={onOpen} style={{ height: metrics.heroStage, alignItems: "center", justifyContent: "flex-end", overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", left: "6%", right: "6%", bottom: 36, height: 120, borderRadius: 9999, ...glow }} />
      {car.photo ? (
        <Image source={{ uri: car.photo }} resizeMode="cover" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 52, ...feather } as object} />
      ) : (
        <View pointerEvents="none" style={{ position: "absolute", top: 36, alignItems: "center", opacity: 0.35 }}><Icon name="car" color="#F4F2EF" size={72} /></View>
      )}
      <View style={{ alignItems: "center", gap: 6, paddingBottom: metrics.innerGap }}>
        <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "800", textAlign: "center" }}>{car.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: "#C9C6C1", fontSize: 13, fontWeight: "700", letterSpacing: 2 }}>{car.plate}</Text>
          {!car.photo ? <Text style={{ color: "#EC8638", fontSize: 13, fontWeight: "700" }}>Add photo</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}
export { BG as HERO_BG };

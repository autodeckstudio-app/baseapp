// Dev-only: every body shape and colour side by side, for checking the Care map drawings.
import { Image, ScrollView, View } from "react-native";
import { carSvg, svgUri, type BodyShape } from "../lib/car-models";
import { useExperienceTheme } from "@autodeck/ui/native";

const SET: Array<[BodyShape, string]> = [["hatch", "#E9ECEF"], ["sedan", "#6C727B"], ["suv", "#B3262E"], ["mpv", "#B9BFC7"], ["pickup", "#1C1E22"]];
export default function PreviewCars() {
  const { name, colors } = useExperienceTheme();
  if (!__DEV__) return null;
  return (
    <ScrollView horizontal style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ gap: 8, padding: 8 }}>
      {SET.map(([s, c]) => <View key={s}><Image source={{ uri: svgUri(carSvg(s, c, name !== "light", s === "sedan" ? "left" : null)) }} style={{ width: 200, height: 480 }} /></View>)}
    </ScrollView>
  );
}

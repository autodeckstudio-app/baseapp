// Dev-only mock of the Garage All view: the real photo card and facts card with sample cars (no photos, so the honest car-icon state shows).
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Screen } from "../ui/kit";
import { CarPhotoCard } from "../ui/GarageShowroom";
import { GarageCarFacts } from "../ui/GarageCarFacts";

const noop = () => undefined;
const cars = [
  { id: "a", make: "BMW", model: "M340i", registrationNumber: "MH 40 AB 1234", category: "sedan" },
  { id: "b", make: "Mahindra", model: "Thar", registrationNumber: "MH 31 XY 5678", category: "suv" },
] as never[];
export default function PreviewGarage() {
  const { name } = useExperienceTheme();
  const { live } = useLocalSearchParams<{ live?: string }>();
  if (!__DEV__) return null;
  const light = name === "light";
  return (
    <Screen appBar="Garage">
      <View style={{ gap: 16 }}>
        <View style={{ gap: space.line }}>
          <CarPhotoCard car={cars[0]!} height={170} badge={live ? "In the bay now" : null} onOpen={noop} />
          <GarageCarFacts light={light} lastService={"2 Sep 2026 \u00b7 Detail SPA"} due="Ceramic wash due in 12 d" live={live ? { stepName: "In progress", readyBy: "Thu, 5:30 pm", onTrack: noop } : null} />
        </View>
        <View style={{ gap: space.line }}>
          <CarPhotoCard car={cars[1]!} height={170} badge={null} onOpen={noop} />
          <GarageCarFacts light={light} lastService={null} due={null} live={null} />
        </View>
        <Button label="Book a service" onPress={noop} />
        <Button label="Service history" kind="quiet" onPress={noop} />
      </View>
    </Screen>
  );
}

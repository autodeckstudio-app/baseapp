// Dev-only: the Garage "All" view as the website's app section shows it, built from the real parts (no network, no sign-in).
import { useState } from "react";
import { Image, View } from "react-native";
import type { ServiceJob, StoryView, Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Screen } from "../ui/kit";
import { FilterPills } from "../ui/FilterPills";
import { StoryCircles } from "../ui/StoryCircles";
import { TodayStrip } from "../ui/GarageToday";
import { CarPhotoCard } from "../ui/GarageShowroom";
import { glassPane } from "../lib/glass-pane";
import { groupStories } from "../lib/story-groups";
import { metrics } from "../lib/metrics";
import { Pressable, Text } from "react-native";

const noop = () => undefined;
const now = Date.now();
const S = (n: number, h: number, title: string | null): StoryView => ({ id: String(n), mediaType: "image", url: "", caption: null, pinned: title !== null, highlightTitle: title, hidden: false, createdAt: new Date(now - h * 3600e3).toISOString(), expiresAt: new Date(now - h * 3600e3 + 24 * 3600e3).toISOString() });
const car = { id: "c1", make: "Maruti", model: "Baleno", registrationNumber: "GJ 01 ZX 9021", category: "hatchback" } as unknown as Vehicle;
const job = { id: "j1", status: "QUALITY_CHECK", vehicleId: "c1" } as unknown as ServiceJob;

export default function PreviewGarage() {
  const { colors: ink, name } = useExperienceTheme();
  const [pick, setPick] = useState<string | null>(null);
  if (!__DEV__) return null;
  const light = name === "light";
  const groups = groupStories([S(1, 2, null), S(2, 30, "Studio"), S(3, 90, "PPF")]);
  return (
    <Screen appBar="Garage">
      <FilterPills items={[{ key: null as string | null, label: "All" }, { key: "c1", label: "Maruti Baleno" }]} value={pick} onChange={setPick} trailing={<Pressable style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: "rgba(128,128,128,0.14)" }}><Text style={{ color: ink.textPrimary, fontSize: 13, fontWeight: "700" }}>+ Add</Text></Pressable>} />
      <StoryCircles groups={groups} seen={new Set()} onOpen={noop} />
      <View style={{ gap: metrics.sectionGap }}>
        <TodayStrip name="Maruti Baleno" job={job} ink={ink} light={light} onTrack={noop} />
        <CarPhotoCard car={car} height={180} badge="In the bay now" onOpen={noop} photo={<Image source={require("../../assets/imagery/generated/garage-inspection.jpg")} resizeMode="cover" style={{ width: "100%", height: 180 }} />} />
      </View>
      <View style={{ gap: space.breath, marginTop: metrics.sectionGap, paddingBottom: 100 }}>
        <Button label="Book a service" onPress={noop} />
        <Button label="Service history" kind="quiet" onPress={noop} />
      </View>
    </Screen>
  );
}

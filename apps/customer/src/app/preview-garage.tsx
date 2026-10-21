// Dev-only: the Garage "All" view as the website's app section shows it, built from the real parts (no network, no sign-in).
import { useState } from "react";
import { Image, View } from "react-native";
import type { ServiceJob, StoryView, Vehicle } from "@autodeck/core";
import { RaisedTabBar } from "../ui/RaisedTabBar";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Screen } from "../ui/kit";
import { FilterPills } from "../ui/FilterPills";
import { StoryCircles } from "../ui/StoryCircles";
import { TodayStrip } from "../ui/GarageToday";
import { CarPhotoCard } from "../ui/GarageShowroom";
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
    <View style={{ flex: 1 }}>
    <Screen appBar="Garage">
      <View style={{ gap: 12 }}>
        <FilterPills outlined items={[{ key: null as string | null, label: "All" }, { key: "c1", label: "Maruti Baleno" }]} value={pick} onChange={setPick} trailing={<Pressable style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 7, borderWidth: 1, borderColor: light ? "rgba(22,24,28,0.18)" : "rgba(255,255,255,0.22)", backgroundColor: light ? "rgba(255,255,255,0.7)" : "transparent" }}><Text style={{ color: ink.textPrimary, fontSize: 13, fontWeight: "700" }}>+ Add</Text></Pressable>} />
        <StoryCircles size={58} groups={groups} seen={new Set()} onOpen={noop} />
        <TodayStrip name="Maruti Baleno" job={job} ink={ink} light={light} onTrack={noop} />
        <CarPhotoCard car={car} height={180} badge="In the bay now" onOpen={noop} photo={<Image source={require("../../assets/imagery/generated/garage-inspection.jpg")} resizeMode="cover" style={{ width: "100%", height: 180 }} />} />
        <View style={{ gap: 9, paddingBottom: 100 }}>
          <Button label="Book a service" style={{ minHeight: 44, marginTop: 0 }} onPress={noop} />
          <Button label="Service history" kind="quiet" style={{ minHeight: 44, backgroundColor: "transparent", borderWidth: 1, borderColor: light ? "rgba(22,24,28,0.3)" : "rgba(255,255,255,0.3)", shadowOpacity: 0, elevation: 0 }} onPress={noop} />
        </View>
      </View>
    </Screen>
    <RaisedTabBar state={{ index: 3, routes: ["bookings", "catalogue", "index", "garage", "profile"].map((n) => ({ key: n, name: n })) }} descriptors={{}} navigation={{ navigate: noop, emit: () => ({ defaultPrevented: false }) }} icons={{ index: "home", catalogue: "services", bookings: "bookings", garage: "garage", profile: "profile" }} />
    </View>
  );
}

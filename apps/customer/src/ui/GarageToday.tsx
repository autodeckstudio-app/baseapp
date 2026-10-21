// The "Today" card on Garage: the car that is in the bay, its four steps and a Track link.
import { Pressable, Text, View } from "react-native";
import type { ServiceJob } from "@autodeck/core";
import type { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { metrics } from "../lib/metrics";
import { jobStep, LIVE_STEP_NAMES, readyBy } from "../lib/garage-live";

export function TodayStrip({ name, job, ink, light, onTrack }: { name: string; job: ServiceJob; ink: ReturnType<typeof useExperienceTheme>["colors"]; light: boolean; onTrack: () => void }) {
  const step = jobStep(job.status);
  const ready = readyBy(job);
  return (
    <View style={{ ...glassPane(light), padding: metrics.cardPad, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>TODAY</Text>
          <Text numberOfLines={1} style={{ color: ink.textPrimary, fontSize: 17, fontWeight: "800" }}>{`${name} is in the bay`}</Text>
          <Text style={{ color: ink.textSecondary, fontSize: 13 }}>{ready ? `${LIVE_STEP_NAMES[step]}, ready by ${ready}` : LIVE_STEP_NAMES[step]}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Track and chat" onPress={onTrack} hitSlop={8}><Text style={{ color: "#C96A12", fontSize: 13, fontWeight: "800" }}>Track</Text></Pressable>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 4`} style={{ flexDirection: "row", gap: 6 }}>
        {LIVE_STEP_NAMES.map((n, i) => (
          <View key={n} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 5, borderRadius: 9999, backgroundColor: i <= step ? "#EC8638" : "rgba(128,128,128,0.3)" }} />
            <Text numberOfLines={1} style={{ color: i <= step ? ink.textPrimary : ink.textSecondary, fontSize: 10.5, fontWeight: i === step ? "700" : "500" }}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

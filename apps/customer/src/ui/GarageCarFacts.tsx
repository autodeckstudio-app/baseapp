// The facts about one car in the Garage: last service, what is due next, and the live visit when it is in the studio.
// Same data as the car card badge, but owned by the car. No booking list, no prices.
import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { metrics } from "../lib/metrics";

export type CarFactsProps = { lastService: string | null; due: string | null; live: { stepName: string; readyBy: string | null; onTrack: () => void } | null; light: boolean; joined?: boolean };

function Row({ label, value, ink }: { label: string; value: string; ink: ReturnType<typeof useExperienceTheme>["colors"] }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: ink.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: ink.textPrimary, fontSize: 15, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

export function GarageCarFacts({ lastService, due, live, light, joined }: CarFactsProps) {
  const { colors: ink } = useExperienceTheme();
  return (
    <View style={{ ...glassPane(light), ...(joined ? { borderRadius: 0, borderWidth: 0, shadowOpacity: 0, elevation: 0 } : null), padding: metrics.cardPad, gap: 12 }}>
      {live ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>IN THE BAY NOW</Text>
            <Text numberOfLines={2} style={{ color: ink.textPrimary, fontSize: 15, fontWeight: "700" }}>{live.readyBy ? `${live.stepName}, ready by ${live.readyBy}` : live.stepName}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Track and chat" onPress={live.onTrack} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: ink.textPrimary, fontSize: 13, fontWeight: "800" }}>Track</Text>
          </Pressable>
        </View>
      ) : null}
      <Row label="LAST SERVICE" value={lastService ?? "No finished service yet"} ink={ink} />
      <Row label="NEXT DUE" value={due ?? "Nothing due"} ink={ink} />
    </View>
  );
}

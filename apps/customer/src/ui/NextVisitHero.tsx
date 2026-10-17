// The next booked visit as one hero card: a big date block, what and which car, and how soon.
import { Pressable, View } from "react-native";
import { glassSurface, glassInner } from "../lib/glass";
import { metrics } from "../lib/metrics";
import { daysUntilLabel } from "../lib/bookings-view";
import { Chip, T } from "./kit";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function NextVisitHero({ date, today, time, title, car, status, onPress }: { date: string; today: string; time: string; title: string; car: string; status: string; onPress: () => void }) {
  const day = Number(date.slice(8, 10));
  const mon = MON[Number(date.slice(5, 7)) - 1] ?? "";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Next visit, ${title}, ${daysUntilLabel(date, today)}`} onPress={onPress} style={({ pressed }) => ({ borderRadius: 24, ...glassSurface, padding: metrics.cardPad, gap: 12, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: 72, borderRadius: 16, backgroundColor: glassInner.backgroundColor, alignItems: "center", paddingVertical: 10 }}>
          <T role="label" tone="accent">{mon}</T>
          <T role="display">{day}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <T role="label" tone="secondary">{daysUntilLabel(date, today).toUpperCase()}</T>
          <T role="heading" numberOfLines={2}>{title}</T>
          <T role="caption" tone="secondary" numberOfLines={1}>{[car, time].filter(Boolean).join(" · ")}</T>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}><Chip label={status} tone="premium" /></View>
    </Pressable>
  );
}

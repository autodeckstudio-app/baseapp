// The next booked visit as one hero card: a big date block, what and which car, and how soon.
import { Pressable, View } from "react-native";
import type { ReactNode } from "react";
import { glassSurface, glassInner } from "../lib/glass";
import { metrics } from "../lib/metrics";
import { daysUntilLabel } from "../lib/bookings-view";
import { Chip, T } from "./kit";

const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function NextVisitHero({ date, today, time, title, car, status, onPress, children, trailingAction }: { date: string; today: string; time: string; title: string; car: string; status: string; onPress: () => void; children?: ReactNode; trailingAction?: ReactNode }) {
  const day = Number(date.slice(8, 10));
  const mon = MON[Number(date.slice(5, 7)) - 1] ?? "";
  return (
    <View style={{ borderRadius: 28, ...glassSurface, padding: metrics.cardPad, gap: 20 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Next visit, ${title}, ${daysUntilLabel(date, today)}`} onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: 72, borderRadius: 16, backgroundColor: "rgba(128,148,172,.12)", alignItems: "center", paddingVertical: 10 }}>
          <T role="label" tone="secondary">{mon}</T>
          <T role="display">{day}</T>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: metrics.identityGap }}>
          <T role="label" tone="secondary">{daysUntilLabel(date, today).toUpperCase()}</T>
          <T role="heading">{title}</T>
          <T role="caption" tone="secondary">{[car, time].filter(Boolean).join(" · ")}</T>
        </View>
      </View>
    </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap:"wrap",gap: 12 }}><Chip label={status} tone="premium" />{trailingAction}</View>
      {children}
    </View>
  );
}

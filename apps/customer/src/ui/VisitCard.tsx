// One booking row in the reference style: photo tile, service, car, time, price, status.
import { glassSurface, glassInner, glassQuiet } from "../lib/glass";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { T } from "./kit";

export function VisitCard({ photo, title, car, when, price, chip, onPress }: { photo: ReactNode; title: string; car: string; when: string; price: string; chip: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 12, alignItems: "center", borderRadius: 16, ...glassSurface, padding: 8, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden" }}>{photo}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T role="bodyStrong" numberOfLines={1}>{title}</T>
        <T role="caption" tone="secondary" numberOfLines={1}>{[car, when].filter(Boolean).join(" · ")}</T>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <T role="bodyStrong" tone="accent">{price}</T>
          {chip}
        </View>
      </View>
    </Pressable>
  );
}

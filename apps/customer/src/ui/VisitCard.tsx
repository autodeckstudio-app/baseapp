// One booking row in the reference style: photo tile, service, car, time, price, status.
import { glassSurface, glassInner, glassOrange } from "../lib/glass";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { T } from "./kit";

export function VisitCard({ photo, title, car, when, price, chip, onPress }: { photo: ReactNode; title: string; car: string; when: string; price: string; chip: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", gap: 14, alignItems: "center", borderRadius: 20, ...glassSurface, padding: 10, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ width: 92, height: 92, borderRadius: 16, overflow: "hidden" }}>{photo}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <T role="bodyStrong" numberOfLines={1}>{title}</T>
        <T role="caption" tone="secondary" numberOfLines={1}>{car}</T>
        <T role="caption" tone="tertiary" numberOfLines={1}>{when}</T>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <T role="bodyStrong">{price}</T>
          {chip}
        </View>
      </View>
    </Pressable>
  );
}

// One car in the garage list: photo, name over a fade, plate and facts below.
import { glassSurface, glassInner, glassQuiet } from "../lib/glass";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Plate, T } from "./kit";

export function GarageCard({ photo, height, kicker, title, lead, plate, chips, onPress, onRemove }: { photo: ReactNode; height: number; kicker?: string | undefined; title: string; lead: boolean; plate: string; chips: string[]; onPress: () => void; onRemove: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => ({ width: "100%", borderRadius: 24, overflow: "hidden", ...glassSurface, opacity: pressed ? 0.88 : 1 })}>
      {photo}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.45) 0%, rgba(5,5,6,0) 35%, rgba(27,27,31,1) 100%)" } as object) }} />
      <Pressable onPress={(e) => { e.stopPropagation?.(); onRemove(); }} accessibilityRole="button" accessibilityLabel={`Remove ${plate} from your garage`} hitSlop={8} style={({ pressed }) => ({ position: "absolute", top: 12, right: 12, height: 32, borderRadius: 16, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Remove</Text>
      </Pressable>
      <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, top: height - 60, gap: 2 }}>
        {kicker ? <T role="label" tone="accent">{kicker}</T> : null}
        <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: lead ? 22 : 18, fontWeight: "700" }}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 14 }}>
        <Plate value={plate} />
        {chips.map((t) => (
          <View key={t} style={{ borderRadius: 9999, ...glassInner, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T role="caption" tone="secondary" style={{ textTransform: "capitalize" }}>{t}</T>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

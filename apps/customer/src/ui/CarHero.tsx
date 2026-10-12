import { useExperienceTheme } from "@autodeck/ui/native";
// Car detail head in the reference layout: full-bleed photo, then a rounded
// sheet that overlaps it with name, plate, key facts and the primary action.
import { glassSurface, glassInner, glassQuiet } from "../lib/glass";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Plate, T } from "./kit";

export function CarHero({ photo, title, subtitle, plate, facts, onBook }: { photo: ReactNode; title: string; subtitle: string; plate: string; facts: Array<{ label: string; value: string }>; onBook: () => void }) {
  const { colors: ink } = useExperienceTheme();
  return (
    <View style={{ marginHorizontal: -20, marginTop: -8 }}>
      <View style={{ height: 300, backgroundColor: "#121214", overflow: "hidden" }}>
        {photo}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.35) 0%, rgba(5,5,6,0) 40%, rgba(5,5,6,0.55) 100%)" } as object) }} />
      </View>
      <View style={{ marginTop: -34, borderTopLeftRadius: 34, borderTopRightRadius: 34, ...glassSurface, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T role="title" style={{ color: ink.textPrimary }} numberOfLines={2}>{title}</T>
            <T role="caption" tone="secondary">{subtitle}</T>
          </View>
          <Plate value={plate} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {facts.map((f) => (
            <View key={f.label} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4, borderRadius: 16, ...glassInner, paddingVertical: 12, paddingHorizontal: 4 }}>
              <T role="label" tone="accent" numberOfLines={1} >{f.value}</T>
              <T role="caption" tone="tertiary" numberOfLines={1}>{f.label}</T>
            </View>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onBook} style={({ pressed }) => ({ height: 54, borderRadius: 27, ...glassQuiet, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          <T role="bodyStrong" style={{ color: ink.textPrimary, fontWeight: "700" }}>Book a service</T>
        </Pressable>
      </View>
    </View>
  );
}

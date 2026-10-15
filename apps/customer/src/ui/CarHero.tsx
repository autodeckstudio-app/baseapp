import { useExperienceTheme } from "@autodeck/ui/native";
// Car detail head in the reference layout: full-bleed photo, then a rounded
// sheet that overlaps it with name, plate, key facts and the primary action.
import { glassSurface, glassQuiet } from "../lib/glass";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Plate, T } from "./kit";
import { metrics } from "../lib/metrics";

export function CarHero({ photo, title, subtitle, plate, facts, onBook, compact }: { compact?: boolean; photo: ReactNode; title: string; subtitle?: string; plate: string; facts: Array<{ label: string; value: string }>; onBook: () => void }) {
  const { colors: ink } = useExperienceTheme();
  const heroH = compact ? metrics.heroCompact : metrics.heroTall;
  return (
    <View style={{ marginHorizontal: -20, marginTop: -8 }}>
      <View style={{ height: heroH, backgroundColor: "#121214", overflow: "hidden" }}>
        {photo}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: heroH, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.35) 0%, rgba(5,5,6,0) 40%, rgba(5,5,6,0.55) 100%)" } as object) }} />
      </View>
      <View style={{ marginTop: -34, marginHorizontal: 20, borderRadius: 24, ...glassSurface, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T role="title" style={{ color: ink.textPrimary }} numberOfLines={2}>{title}</T>
            {subtitle ? <T role="caption" tone="secondary">{subtitle}</T> : null}
          </View>
          <Plate value={plate} />
        </View>
        {facts.length ? <T role="caption" tone="secondary" numberOfLines={1}>{facts.filter((f) => f.label !== "Protection").map((f) => f.value).filter((v) => v && v !== "-").join("  \u00b7  ")}</T> : null}
        <Pressable accessibilityRole="button" onPress={onBook} style={({ pressed }) => ({ height: 54, borderRadius: 24, ...glassQuiet, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          <T role="bodyStrong" style={{ color: ink.textPrimary, fontWeight: "700" }}>Book a service</T>
        </Pressable>
      </View>
    </View>
  );
}

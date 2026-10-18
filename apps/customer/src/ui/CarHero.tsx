import { useExperienceTheme } from "@autodeck/ui/native";
// Car detail head, cover style: a tall full-bleed photo with the name and plate on it, then ONE glass strip that
// overlaps the photo with the next booking and the single booking action. Nothing else on the page books.
import { glassSurface } from "../lib/glass";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Plate, T } from "./kit";
import { metrics } from "../lib/metrics";

export function CarHero({ photo, title, subtitle, plate, facts, next, onBook, onNext, compact }: { compact?: boolean; photo: ReactNode; title: string; subtitle?: string; plate: string; facts: Array<{ label: string; value: string }>; next?: { title: string; detail: string } | null; onBook: () => void; onNext?: (() => void) | undefined }) {
  const { colors: ink, name: themeName } = useExperienceTheme();
  const heroH = compact ? metrics.heroCompact + 60 : metrics.heroCover;
  const line = facts.filter((f) => f.label !== "Protection").map((f) => f.value).filter((v) => v && v !== "-").join("  \u00b7  ");
  return (
    <View style={{ marginHorizontal: -20, marginTop: -8 }}>
      <View style={{ height: heroH, backgroundColor: "#121214", overflow: "hidden" }}>
        {photo}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: heroH, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.3) 0%, rgba(5,5,6,0) 35%, rgba(5,5,6,0.78) 100%)" } as object) }} />
        <View style={{ position: "absolute", left: 20, right: 20, bottom: 48, gap: 8 }}>
          <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: -0.5, lineHeight: 33 }}>{title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Plate value={plate} />
            {line ? <Text numberOfLines={1} style={{ flex: 1, color: "#E4E2DF", fontSize: 12 }}>{line}</Text> : null}
          </View>
          {subtitle ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={{ marginTop: -34, marginHorizontal: 20, borderRadius: 24, ...glassSurface, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Pressable accessibilityRole="button" disabled={!next || !onNext} onPress={onNext} style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: ink.textTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Next up</Text>
          <T role="bodyStrong" style={{ color: ink.textPrimary, fontWeight: "800" }} numberOfLines={1}>{next ? next.title : "Nothing booked"}</T>
          <T role="caption" tone="secondary" numberOfLines={1}>{next ? next.detail : "Pick a time that suits you"}</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onBook} style={({ pressed }) => ({ height: 44, paddingHorizontal: 18, borderRadius: 9999, backgroundColor: ink.textPrimary, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1 })}>
          <Text style={{ color: themeName === "night" ? "#14141A" : "#FFFFFF", fontWeight: "700", fontSize: 14 }}>Book a service</Text>
        </Pressable>
      </View>
    </View>
  );
}

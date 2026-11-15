import { useExperienceTheme } from "@autodeck/ui/native";
// Car detail head, cover style: a tall full-bleed photo with the name and plate on it, then ONE glass strip that
// overlaps the photo with the next booking and the single booking action. Nothing else on the page books.
import { glassSurface } from "../lib/glass";
import { useEffect, useRef, type ReactNode } from "react";
import { useReduceMotion } from "../lib/reduce-motion";
import { Animated, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Plate, T } from "./kit";
import { metrics } from "../lib/metrics";

export function CarHero({ photo, title, subtitle, plate, facts, next, onBook, onNext, compact }: { compact?: boolean; photo: ReactNode; title: string; subtitle?: string; plate: string | null; facts: Array<{ label: string; value: string }>; next?: { title: string; detail: string } | null; onBook?: (() => void) | undefined; onNext?: (() => void) | undefined }) {
  const { colors: ink, name: themeName } = useExperienceTheme();
  const { width: stripWidth } = useWindowDimensions();
  const narrowStrip = stripWidth < 480;
  const heroH = compact ? metrics.heroCompact + 60 : metrics.heroCover;
  // Cinematic entrance: the cover photo settles from a slight zoom while the name and the
  // booking strip rise into place. Skipped entirely when the customer asked for less motion.
  const reduce = useReduceMotion();
  const enter = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const strip = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(enter, { toValue: 1, duration: 520, useNativeDriver: Platform.OS !== "web" }).start();
    Animated.timing(strip, { toValue: 1, duration: 420, delay: 160, useNativeDriver: Platform.OS !== "web" }).start();
  }, [enter, strip, reduce]);
  const photoIn = { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.07, 1] }) }] };
  const riseIn = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] };
  const stripIn = { opacity: strip, transform: [{ translateY: strip.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] };
  const line = facts.filter((f) => f.label !== "Protection").map((f) => f.value).filter((v) => v && v !== "-").join("  \u00b7  ");
  return (
    <View style={{ marginHorizontal: -20, marginTop: -8 }}>
      <View style={{ height: heroH, backgroundColor: "#121214", overflow: "hidden" }}>
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, height: heroH }, photoIn]}>
          {photo}
        </Animated.View>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: heroH, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.3) 0%, rgba(5,5,6,0) 35%, rgba(5,5,6,0.78) 100%)" } as object) }} />
        <Animated.View style={[{ position: "absolute", left: 20, right: 20, bottom: 48, gap: 8 }, riseIn]}>
          <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: -0.5, lineHeight: 33 }}>{title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {plate !== null && plate !== "" ? <Plate value={plate} /> : null}
            {line ? <Text numberOfLines={1} style={{ flex: 1, color: "#E4E2DF", fontSize: 12 }}>{line}</Text> : null}
          </View>
          {subtitle ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{subtitle}</Text> : null}
        </Animated.View>
      </View>
      {onBook || next ? (
      <Animated.View style={[{ marginTop: -34, marginHorizontal: 20, borderRadius: 24, ...glassSurface, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 18, paddingVertical: 16, flexDirection: narrowStrip ? "column" : "row", alignItems: narrowStrip ? "stretch" : "center", justifyContent: "space-between", gap: 12 }, stripIn]}>
        <Pressable accessibilityRole="button" disabled={!next || !onNext} onPress={onNext} style={{ flex: 1, minWidth: 0, gap: metrics.identityGap }}>
          <Text style={{ color: ink.textTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Next up</Text>
          <T role="bodyStrong" style={{ color: ink.textPrimary, fontWeight: "800" }} numberOfLines={narrowStrip ? 3 : 1}>{next ? next.title : "Nothing booked"}</T>
          <T role="caption" tone="secondary" numberOfLines={narrowStrip ? 3 : 1}>{next ? next.detail : "Pick a time that suits you"}</T>
        </Pressable>
        {onBook ? (
        <Pressable accessibilityRole="button" onPress={onBook} style={({ pressed }) => ({ height: 44,alignSelf:narrowStrip?"flex-start":"auto", paddingHorizontal: narrowStrip ? 14 : 18, borderRadius: 9999, backgroundColor: ink.textPrimary, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.88 : 1, flexShrink: 0 })}>
          <Text style={{ color: themeName === "night" ? "#14141A" : "#FFFFFF", fontWeight: "700", fontSize: narrowStrip ? 13 : 14 }}>Book a service</Text>
        </Pressable>
        ) : null}
      </Animated.View>
      ) : null}
    </View>
  );
}

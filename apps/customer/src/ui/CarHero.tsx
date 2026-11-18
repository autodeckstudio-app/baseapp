import { useExperienceTheme } from "@autodeck/ui/native";
import { metrics } from "../lib/metrics";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Plate, T, Pane } from "./kit";

/** Car room identity. The recorded photo and structured facts stay separate. */
export function CarHero({ photo, title, subtitle, plate, facts, next, onBook, onNext, compact }: { compact?: boolean; photo: ReactNode; title: string; subtitle?: string; plate: string | null; facts: Array<{ label: string; value: string }>; next?: { title: string; detail: string } | null; onBook?: (() => void) | undefined; onNext?: (() => void) | undefined }) {
  const { colors, name } = useExperienceTheme();
  return <View style={{ gap: 16 }}>
    <View style={{ gap: metrics.identityGap }}><T role="label" tone="tertiary">YOUR CAR</T><T role="title" style={{ fontSize: 30, lineHeight: 36 }}>{title}</T><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>{plate ? <Plate value={plate} /> : null}{subtitle ? <T role="caption" tone="secondary">{subtitle}</T> : null}</View></View>
    <View style={{ height: compact ? 200 : 250, borderRadius: 28, overflow: "hidden", backgroundColor: name === "light" ? "#DCE5EE" : "#1A2939" }}>{photo}</View>
    <Pane pad="inset"><View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 18 }}>{facts.filter(f => f.value && f.value !== "-").map(f => <View key={f.label} style={{ width: "44%", flexGrow: 1, gap: 5 }}><T role="caption" tone="tertiary">{f.label}</T><T role="bodyStrong">{f.value}</T></View>)}</View></Pane>
    {onBook || next ? <Pane pad="inset"><View style={{ gap: 16 }}><Pressable accessibilityRole="button" disabled={!next || !onNext} onPress={onNext} style={{ gap: 7 }}><T role="label" tone="tertiary">NEXT VISIT</T><T role="heading">{next?.title ?? "Nothing booked"}</T><T tone="secondary">{next?.detail ?? "Pick a time that suits you"}</T></Pressable>{onBook ? <Pressable accessibilityRole="button" onPress={onBook} style={({ pressed }) => ({ alignSelf: "flex-start", minHeight: 46, paddingHorizontal: 20, borderRadius: 16, backgroundColor: colors.textPrimary, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}><T role="label" style={{ color: name === "light" ? "#FFFFFF" : "#132030" }}>Book a service</T></Pressable> : null}</View></Pane> : null}
  </View>;
}

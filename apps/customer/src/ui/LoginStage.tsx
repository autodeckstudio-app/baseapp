import { LegalLinks } from "./LegalLinks";
import { useEffect, useState, type ReactNode } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Logo, useExperienceTheme } from "@autodeck/ui/native";
import { sceneImagery } from "../lib/imagery";
import { NavIcon } from "./NavIcon";
import { useReduceMotion } from "../lib/reduce-motion";
import { Ambient, Pane, T } from "./kit";

export const LOGIN_PERKS: { icon: "wash" | "pin" | "check"; text: string }[] = [
  { icon: "wash", text: "Book a wash in seconds" },
  { icon: "pin", text: "Track your car" },
  { icon: "check", text: "All bills and warranties" },
];
function PerkRotator() {
  const reduce = useReduceMotion(), { colors, name } = useExperienceTheme();
  const [i, setI] = useState(0);
  useEffect(() => { if (reduce) return; const t = setInterval(() => setI(n => (n + 1) % LOGIN_PERKS.length), 4000); return () => clearInterval(t); }, [reduce]);
  const perk = LOGIN_PERKS[i]!;
  return <View style={{ gap: 16 }}><View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}><View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: name === "light" ? "#E5ECF5" : "#2A3A50", alignItems: "center", justifyContent: "center" }}><NavIcon name={perk.icon} color={colors.textPrimary} size={23} cut={name === "light" ? "#E5ECF5" : "#2A3A50"} /></View><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: "600" }}>{perk.text}</Text></View><View style={{ flexDirection: "row", gap: 8 }}>{LOGIN_PERKS.map((p,n) => <Pressable key={p.text} accessibilityRole="button" accessibilityLabel={`Show tip ${n+1} of ${LOGIN_PERKS.length}`} hitSlop={10} onPress={() => setI(n)} style={{ height: 5, width: n === i ? 28 : 8, borderRadius: 4, backgroundColor: n === i ? colors.textPrimary : colors.borderSubtle }} />)}</View></View>;
}
export function LoginStage({ title, copy, error, children }: { title: string; copy?: string; error?: string | null; children: ReactNode }) {
  const { height } = useWindowDimensions(), { name, colors } = useExperienceTheme();
  const compact = height < 700, web = Platform.OS === "web";
  return <Ambient><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20, paddingTop: web ? "calc(24px + env(safe-area-inset-top, 0px))" as never : 24, paddingBottom: web ? "calc(24px + env(safe-area-inset-bottom, 0px))" as never : 24 }}><View style={{ width: "100%", maxWidth: 440, gap: 24 }}>
    <View style={{ alignItems: "center", paddingVertical: 10 }}><Logo onDark={name !== "light"} variant="stacked" height={compact ? 56 : 72} /></View>
    <View style={{ height: compact ? 120 : 180, borderRadius: 28, overflow: "hidden", backgroundColor: colors.surface }}><Image source={sceneImagery.login} resizeMode="cover" style={{ width: "100%", height: "100%" }} /></View>
    <Pane pad="inset"><View style={{ gap: 24 }}><T role="title" style={{ fontSize: 28, lineHeight: 34 }}>{title}</T>{copy ? <T tone="secondary">{copy}</T> : <PerkRotator />}<View style={{ gap: 12 }}>{children}</View>{error ? <View accessibilityRole="alert" style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.danger }}><T role="caption" tone="danger">{error}</T></View> : null}<T role="caption" tone="secondary">Google sign-in only. We never ask for a password.</T></View></Pane>
    <LegalLinks onDark={name !== "light"} />
  </View></ScrollView></Ambient>;
}

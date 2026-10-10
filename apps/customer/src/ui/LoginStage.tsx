// Expressive sign-in: a slow-moving photo, floating orange light, and a glass
// card that rises in. Web and native share it; the blur is CSS on web.
import type { ReactNode } from "react";
import { Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Logo } from "@autodeck/ui/native";
import { sceneImagery } from "../lib/imagery";
import { Fill, KenBurns, Orb, Rise, VEIL } from "./Drift";

export function LoginStage({ title, copy, error, children }: { title: string; copy: string; error?: string | null; children: ReactNode }) {
  const web = Platform.OS === "web";
  // Fluid sizing: short screens (small iPhones, display zoom, landscape) get tighter spacing so the card always fits or scrolls.
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const safeTop = web ? "env(safe-area-inset-top, 0px)" : 0;
  const safeBottom = web ? "env(safe-area-inset-bottom, 0px)" : 0;
  return (
    <View style={{ flex: 1, backgroundColor: "#050506", overflow: "hidden" }}>
      <KenBurns source={sceneImagery.login} />
      <View pointerEvents="none" style={{ ...Fill, ...VEIL(0.55, 0.92) }} />
      <Orb size={340} color="rgba(245,154,69,0.55)" x="55%" y="-8%" />
      <Orb size={260} color="rgba(236,134,56,0.40)" x="-18%" y="62%" dx={24} dy={30} ms={11000} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end", alignItems: "center", padding: compact ? 14 : 20, paddingTop: web ? (`calc(${compact ? 14 : 20}px + ${safeTop})` as unknown as number) : compact ? 14 : 20, paddingBottom: web ? (`calc(${compact ? 16 : 32}px + ${safeBottom})` as unknown as number) : compact ? 16 : 32 }}>
        <Rise style={{ width: "100%", maxWidth: 420, alignItems: "center", marginBottom: compact ? 14 : 28 }}>
          <Logo onDark variant="stacked" height={compact ? 60 : 84} />
        </Rise>
        <Rise delay={160} style={{ width: "100%", maxWidth: 420 }}>
          <View style={{ borderRadius: 32, padding: compact ? 18 : 24, gap: compact ? 10 : 14, alignItems: "center", backgroundColor: "rgba(18,18,20,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", ...(web ? ({ backdropFilter: "blur(26px) saturate(160%)", WebkitBackdropFilter: "blur(26px) saturate(160%)", boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)" } as object) : {}) }}>
            <Text style={{ color: "#F6F4F1", fontFamily: "Montserrat, Inter, sans-serif", fontSize: 26, fontWeight: "700", textAlign: "center" }}>{title}</Text>
            <Text style={{ color: "#CDCBC8", fontSize: 15, lineHeight: 22, textAlign: "center" }}>{copy}</Text>
            <View style={{ width: "100%", gap: 10, marginTop: 6 }}>{children}</View>
            {error ? <Text style={{ color: "#FF8D7A", fontSize: 13, textAlign: "center" }}>{error}</Text> : null}
            <Text style={{ color: "#A9A7A4", fontSize: 12, textAlign: "center" }}>Google sign-in only. We never ask for a password.</Text>
          </View>
        </Rise>
      </ScrollView>
    </View>
  );
}

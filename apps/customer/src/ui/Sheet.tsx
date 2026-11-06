import{useExperienceTheme}from"@autodeck/ui/native";
import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { metrics } from "../lib/metrics";

// A light sheet for booking and payment: warm off-white, softly frosted, never stark white.
const INK = "#16181C";
const SOFT = "#5B5750";
const LINE = "rgba(22,24,28,0.10)";
const web = Platform.OS === "web";

export function Sheet({ children }: { children: ReactNode }) {
  const {name,colors}=useExperienceTheme();
  return (
    <View style={{ borderRadius: metrics.cardRadius, padding: metrics.cardPad, gap: metrics.innerGap, backgroundColor: name==="light"?"rgba(240,234,226,0.95)":colors.surfaceElevated, borderWidth: 1, borderColor: name==="light"?"rgba(255,255,255,0.5)":colors.borderSubtle, ...(web ? ({ backdropFilter: "blur(18px) saturate(130%)", WebkitBackdropFilter: "blur(18px) saturate(130%)", boxShadow: "0 12px 34px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.7)" } as object) : {}) }}>
      {children}
    </View>
  );
}

/** One big number with a tiny label. */
export function SheetTotal({ label, value }: { label: string; value: string }) {
  const {name,colors}=useExperienceTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: name==="light"?SOFT:colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: name==="light"?INK:colors.textPrimary, fontSize: 36, fontWeight: "800", lineHeight: 42 }}>{value}</Text>
    </View>
  );
}

export function SheetLine({ label, value, small = false, last = false }: { label: string; value: string; small?: boolean; last?: boolean }) {
  const {name,colors}=useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, paddingVertical: small ? 4 : 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: small ? "transparent" : name==="light"?LINE:colors.borderSubtle }}>
      <Text style={{ color: name==="light"?SOFT:colors.textSecondary, fontSize: small ? 13 : 14 }}>{label}</Text>
      <Text style={{ color: name==="light"?INK:colors.textPrimary, fontSize: small ? 13 : 15, fontWeight: small ? "500" : "700", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

export function SheetDivider() {
  const{name,colors}=useExperienceTheme();
  return <View style={{ height: 1, backgroundColor: name==="light"?LINE:colors.borderSubtle }} />;
}

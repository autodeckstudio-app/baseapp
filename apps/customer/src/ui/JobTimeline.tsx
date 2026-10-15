import { Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { jobTimeline } from "./job-stage";
import { metrics } from "../lib/metrics";
import { raised } from "../lib/raised";

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Four steps, each with the time it began. No photos, no staff notes. */
export function JobTimeline({ status, history }: { status: string; history: Array<{ status: string; changedAt: string }> }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const steps = jobTimeline(status, history);
  return (
    <View style={{ borderRadius: metrics.cardRadius, padding: metrics.cardPad, gap: 12, ...r.card }}>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Progress</Text>
      {steps.map((s) => (
        <View key={s.label} accessibilityLabel={`${s.label}${s.at ? `, ${clock(s.at)}` : s.state === "next" ? ", next" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.state === "next" ? "transparent" : "#EC8638", borderWidth: 1.5, borderColor: s.state === "next" ? colors.textTertiary : "#EC8638" }} />
          <Text style={{ flex: 1, color: s.state === "next" ? colors.textTertiary : colors.textPrimary, fontSize: 15, fontWeight: s.state === "now" ? "800" : "600" }}>{s.label}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{s.at ? clock(s.at) : ""}</Text>
        </View>
      ))}
    </View>
  );
}

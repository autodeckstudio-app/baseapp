import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { T } from "./kit";
/** Informational progress only. Navigation and business state stay with the route. */
export function JourneySteps({ labels, current }: { labels: string[]; current: number }) {
  const { colors, name } = useExperienceTheme();
  return <View accessibilityLabel={`Step ${current + 1} of ${labels.length}: ${labels[current]}`} style={{ flexDirection: "row", gap: 8, paddingVertical: 6 }}>{labels.map((label, i) => <View key={label} style={{ flex: 1, minWidth: 0, gap: 9 }}><View style={{ height: 3, borderRadius: 2, backgroundColor: i <= current ? colors.textPrimary : colors.borderSubtle }} /><View style={{ gap: 3 }}><T role="caption" tone={i === current ? "primary" : "tertiary"}>{String(i + 1).padStart(2, "0")}</T><T role="caption" tone={i === current ? "primary" : "secondary"}>{label}</T></View></View>)}</View>;
}

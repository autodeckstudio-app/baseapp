// Profile identity card: one glass card, same language as Home. Name, email, one Edit action. No tiles.
import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { metrics } from "../lib/metrics";

export function ProfileHero({ name, email, onEdit }: { name: string; email?: string | null | undefined; onEdit: () => void }) {
  const { name: themeName, colors } = useExperienceTheme();
  const light = themeName === "light";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: metrics.cardPad, ...glassPane(light) }}>
      <View style={{ width: 60, height: 60, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: light ? "#16181C" : "#F3F1ED" }}>
        <Text style={{ color: light ? "#F4F1EC" : "#16181C", fontSize: 24, fontWeight: "800" }}>{(name.trim()[0] ?? "A").toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 19, fontWeight: "800" }}>{name}</Text>
        {email ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>{email}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Edit name" onPress={onEdit} hitSlop={8} style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "rgba(128,128,128,0.14)" }}>
        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>Edit</Text>
      </Pressable>
    </View>
  );
}

import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";

export function ListRow({ icon, title, detail, action, onPress, last }: { icon: "search" | "chat"; title: string; detail: string; action?: string; onPress: () => void; last?: boolean }) {
  const { colors } = useExperienceTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, opacity: pressed ? 0.8 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(128,128,128,0.16)" })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(128,128,128,0.12)", alignItems: "center", justifyContent: "center" }}><NavIcon name={icon} color={colors.textPrimary} size={20} cut="#18181C" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11 }}>{detail}</Text>
      </View>
      {action ? <View style={{ borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(128,128,128,0.14)" }}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{action}</Text></View> : null}
    </Pressable>
  );
}

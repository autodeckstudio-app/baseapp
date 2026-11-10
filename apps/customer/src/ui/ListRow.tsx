import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";

export function ListRow({ icon, title, detail, action, expanded, onPress, last }: { icon: "search" | "chat"; title: string; detail: string; action?: string; expanded?: boolean; onPress: () => void; last?: boolean }) {
  const { colors, name } = useExperienceTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={expanded === undefined ? undefined : {expanded}} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, opacity: pressed ? 0.8 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(128,128,128,0.16)" })}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(128,128,128,0.12)", alignItems: "center", justifyContent: "center" }}><NavIcon name={icon} color={colors.textPrimary} size={20} cut="#18181C" /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 11 }}>{detail}</Text>
      </View>
      <NavIcon name={action === "Close" ? "close" : "proceed"} size={22} color={colors.textSecondary} cut={name === "light" ? "#FFFFFF" : "#252C35"}/>
    </Pressable>
  );
}

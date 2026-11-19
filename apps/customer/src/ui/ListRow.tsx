import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";

const FONT = "Inter, system-ui, sans-serif";

export function ListRow({ icon, title, detail, action, expanded, onPress, last }: { icon: "search" | "chat"; title: string; detail: string; action?: string; expanded?: boolean; onPress: () => void; last?: boolean }) {
  const { colors, name } = useExperienceTheme();
  const tile = name === "light" ? "#E7EDF5" : "#29384C";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={expanded === undefined ? undefined : {expanded}} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, opacity: pressed ? 0.8 : 1, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(128,128,128,0.16)" })}>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: tile, alignItems: "center", justifyContent: "center" }}><NavIcon name={icon} color={colors.textPrimary} size={23} cut={tile} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONT, color: colors.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: "500" }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: FONT, color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>{detail}</Text>
      </View>
      {action === "Close" ? <Text style={{ fontFamily: FONT, fontSize: 12, color: colors.textSecondary }}>Close</Text> : null}
    </Pressable>
  );
}

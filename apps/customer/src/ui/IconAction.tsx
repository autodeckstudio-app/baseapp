import { Pressable, Text } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** Small round pencil (edit/replace) or trash (remove/delete) button. Always has an accessible label. */
export function IconAction({ kind, label, onPress, onDark = false }: { kind: "edit" | "delete"; label: string; onPress: () => void; onDark?: boolean }) {
  const { name, colors } = useExperienceTheme();
  const light = name === "light" && !onDark;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress}
      style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: onDark ? "rgba(16,16,20,0.78)" : light ? "rgba(29,27,38,0.08)" : "rgba(255,255,255,0.12)", opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: onDark ? "#F6F4F1" : colors.textPrimary, fontSize: 15, lineHeight: 18 }}>{kind === "edit" ? "\u270E" : "\u{1F5D1}\uFE0E"}</Text>
    </Pressable>
  );
}

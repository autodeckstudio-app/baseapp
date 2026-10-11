import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@autodeck/ui";

// One back control for every detail screen. Goes back when there is history,
// otherwise to the given fallback so a deep link can still step out.
export function BackButton({ fallback = "/(tabs)" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingRight: 12 }}
    >
      <Text style={{ color: colors.accent, fontSize: 28, lineHeight: 28, marginTop: -3 }}>‹</Text>
      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "600" }}>Back</Text>
    </Pressable>
  );
}

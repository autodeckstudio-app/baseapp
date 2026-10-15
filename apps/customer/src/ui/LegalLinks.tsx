import { Linking, Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { PRIVACY_POLICY_URL, TERMS_URL } from "../lib/studio-info";

/** Privacy policy and Terms links. Each one stays hidden until its address is set in studio-info.ts. */
export function LegalLinks({ onDark = false }: { onDark?: boolean }) {
  const { colors } = useExperienceTheme();
  const items = [["Privacy policy", PRIVACY_POLICY_URL], ["Terms", TERMS_URL]].filter(([, u]) => !!u) as [string, string][];
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 20, paddingVertical: 8 }}>
      {items.map(([label, url]) => (
        <Pressable key={label} accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: onDark ? "#CDCBC8" : colors.textSecondary, fontSize: 13, textDecorationLine: "underline" }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Story circles on Home: today's stories first (orange ring), then permanent highlights (soft ring).
import { Image, Pressable, ScrollView, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import type { StoryGroup } from "../lib/story-service";
import { T } from "./kit";

export function StoryCircles({ groups, seen, onOpen }: { groups: StoryGroup[]; seen: Set<string>; onOpen: (g: StoryGroup) => void }) {
  const { colors } = useExperienceTheme();
  const shown = groups.filter((g) => g.cover);
  if (shown.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.line, paddingRight: space.line }}>
      {shown.map((g) => {
        const ring = g.live && !seen.has(g.key) ? colors.accent : colors.borderSubtle;
        return (
          <Pressable key={g.key} accessibilityRole="button" accessibilityLabel={`${g.title}, ${g.items.length} ${g.items.length === 1 ? "story" : "stories"}`} onPress={() => onOpen(g)} style={{ width: 60, alignItems: "center", gap: 6 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: ring, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 24, overflow: "hidden", backgroundColor: colors.accentHaze, alignItems: "center", justifyContent: "center" }}>
                <Image source={{ uri: g.cover ?? undefined }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
              </View>
            </View>
            <T role="caption" tone={g.live ? "accent" : "secondary"} numberOfLines={1}>{g.title}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Story tray on Home, Instagram style: a ring around each circle (orange until seen, then quiet), the title under it. Today first, then the five highlights.
import { Image, Pressable, ScrollView, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import type { StoryGroup } from "../lib/story-service";
import { seenKeyOf } from "../lib/story-groups";
import { T } from "./kit";

export function StoryCircles({ groups, seen, onOpen, size = 68 }: { groups: StoryGroup[]; seen: Set<string>; onOpen: (g: StoryGroup) => void; size?: number }) {
  const { colors } = useExperienceTheme();
  const shown = groups;
  if (shown.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.line, paddingRight: space.line }}>
      {shown.map((g) => {
        const ring = seen.has(seenKeyOf(g)) ? colors.borderSubtle : colors.accent;
        return (
          <Pressable key={g.key} accessibilityRole="button" accessibilityLabel={`${g.title}, ${g.items.length} ${g.items.length === 1 ? "story" : "stories"}`} onPress={() => onOpen(g)} style={{ width: size + 4, alignItems: "center", gap: 6 }}>
            <View style={{ width: size, height: size, borderRadius: 9999, borderWidth: 2, borderColor: ring, padding: 3 }}>
              <View style={{ flex: 1, borderRadius: 9999, overflow: "hidden", backgroundColor: colors.accentHaze, alignItems: "center", justifyContent: "center" }}>
                {g.cover ? <Image source={{ uri: g.cover }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <T role="title" tone="secondary">{(g.title.trim()[0] ?? "H").toUpperCase()}</T>}
              </View>
            </View>
            <T role="caption" tone="secondary" numberOfLines={1}>{g.title}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

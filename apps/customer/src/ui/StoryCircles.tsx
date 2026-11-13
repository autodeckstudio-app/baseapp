// Story tray on Home, Instagram style: a ring around each circle (orange until seen, then quiet), the title under it. Today first, then the five highlights.
import { Pressable, ScrollView, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import type { StoryGroup } from "../lib/story-service";
import { seenKeyOf } from "../lib/story-groups";
import { StoryCover } from "./StoryCover";
import { T } from "./kit";

export function StoryCircles({ groups, seen, onOpen, compact = false }: { compact?: boolean; groups: StoryGroup[]; seen: Set<string>; onOpen: (g: StoryGroup) => void }) {
  const { colors } = useExperienceTheme();
  const shown = groups;
  if (shown.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.line, paddingRight: space.line, paddingVertical: 4 }}>
      {shown.map((g) => {
        const ring = !g.live || seen.has(seenKeyOf(g)) ? colors.borderSubtle : colors.accent;
        return (
          <Pressable key={g.key} accessibilityRole="button" accessibilityHint="Opens full-screen stories. Tap the sides to move, hold to pause, swipe down to close." accessibilityLabel={`${g.title}, ${g.items.length} ${g.items.length === 1 ? "story" : "stories"}`} onPress={() => onOpen(g)} style={{ minWidth: compact ? 84 : 72, minHeight: 44, flexDirection: compact ? "row" : "column", alignItems: "center", gap: compact ? 8 : 6 }}>
            <View style={{ width: compact ? 34 : 68, height: compact ? 34 : 68, borderRadius: 9999, borderWidth: 2, borderColor: ring, padding: compact ? 2 : 3 }}>
              <View style={{ flex: 1, borderRadius: 9999, overflow: "hidden", backgroundColor: colors.accentHaze, alignItems: "center", justifyContent: "center" }}>
                <StoryCover key={`${g.key}:${g.cover??g.items[g.items.length-1]?.id}`} group={g}/>
              </View>
            </View>
            <T role="caption" tone="secondary" numberOfLines={1}>{g.title}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

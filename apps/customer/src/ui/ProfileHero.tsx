// Smart profile: a tilted 3D member card with a glowing avatar, plus quick
// tiles for the things people open most. All data comes from the caller.
import { glassSurface, glassInner, glassOrange } from "../lib/glass";
import { Platform, Pressable, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";

const ACCENT = "#EC8638";

export type ProfileTile = { icon: IconName; label: string; onPress: () => void };

export function ProfileHero({ name, email, tiles, onEdit }: { name: string; email?: string | null | undefined; tiles: ProfileTile[]; onEdit: () => void }) {
  const { colors: ink } = useExperienceTheme();
  const web = Platform.OS === "web";
  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: "center", paddingTop: 6 }}>
        <View
          style={{
            width: "100%", maxWidth: 360, borderRadius: 24, overflow: "hidden", padding: 22, gap: 18, ...glassSurface,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
            transform: [{ perspective: 900 }, { rotateX: "5deg" }, { rotateY: "-7deg" }],
            ...(web ? ({ backgroundImage: "linear-gradient(135deg, #2A2A2F 0%, #17171A 55%, #0E0E10 100%)", boxShadow: "0 24px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(236,134,56,.10), 28px 30px 60px rgba(236,134,56,.10)" } as object) : { shadowColor: ACCENT, shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 12, height: 18 } }),
          }}
        >
          <View pointerEvents="none" style={{ position: "absolute", right: -60, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(236,134,56,0.20)" }} />
          <View pointerEvents="none" style={{ position: "absolute", right: 30, top: 28, width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: "rgba(236,134,56,0.35)" }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ width: 78, height: 78, borderRadius: 39, padding: 3, backgroundColor: ACCENT, ...(web ? ({ backgroundImage: "linear-gradient(145deg, #F7B070 0%, #EC8638 55%, #B85F1B 100%)", boxShadow: "0 10px 24px rgba(236,134,56,.45)" } as object) : null) }}>
              <View style={{ flex: 1, borderRadius: 36, backgroundColor: "#141416", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#F7B070", fontSize: 32, fontWeight: "800" }}>{(name.trim()[0] ?? "A").toUpperCase()}</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700" }}>{name}</Text>
              {email ? <Text numberOfLines={1} style={{ color: "#B4B2AE", fontSize: 13 }}>{email}</Text> : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ borderRadius: 12, backgroundColor: "rgba(236,134,56,0.16)", paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: "#F3B27A", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 }}>AUTODECK MEMBER</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Edit name" onPress={onEdit} hitSlop={8}>
              <Text style={{ color: ACCENT, fontSize: 14, fontWeight: "600" }}>Edit name</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {tiles.length > 0 ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tiles.map((t) => (
          <Pressable key={t.label} accessibilityRole="button" onPress={t.onPress} style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, borderRadius: 24, ...glassSurface, padding: 16, gap: 12, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 44, height: 44, borderRadius: 24, backgroundColor: "rgba(236,134,56,0.16)", alignItems: "center", justifyContent: "center" }}>
              <Icon name={t.icon} color={ACCENT} size={22} />
            </View>
            <Text style={{ color: ink.textPrimary, fontSize: 15, fontWeight: "600" }}>{t.label}</Text>
          </Pressable>
        ))}
      </View> : null}
    </View>
  );
}

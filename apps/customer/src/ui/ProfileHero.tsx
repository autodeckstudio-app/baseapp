// Smart profile: a tilted 3D member card with a glowing avatar, plus quick
// tiles for the things people open most. All data comes from the caller.
import { glassSurface, glassInner, glassOrange } from "../lib/glass";
import { Platform, Pressable, Text, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { colors as palette } from "@autodeck/ui/tokens";

const ACCENT = palette.accent;

export type ProfileTile = { icon: IconName; label: string; onPress: () => void };

export function ProfileHero({ name, email, tiles, onEdit }: { name: string; email?: string | null | undefined; tiles: ProfileTile[]; onEdit: () => void }) {
  const web = Platform.OS === "web";
  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignItems: "center", paddingTop: 6 }}>
        <View
          style={{
            width: "100%", maxWidth: 360, borderRadius: 20, overflow: "hidden", padding: 22, gap: 18, ...glassSurface,
            
            ...(web ? ({ boxShadow: "0 10px 28px -14px rgba(40,30,20,.25)" } as object) : { shadowColor: ACCENT, shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 12, height: 18 } }),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ width: 78, height: 78, borderRadius: 39, padding: 3, backgroundColor: palette.surfaceSunken }}>
              <View style={{ flex: 1, borderRadius: 36, backgroundColor: palette.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: palette.textPrimary, fontSize: 32, fontWeight: "800" }}>{(name.trim()[0] ?? "A").toUpperCase()}</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={1} style={{ color: palette.textPrimary, fontSize: 22, fontWeight: "700" }}>{name}</Text>
              {email ? <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: 13 }}>{email}</Text> : null}
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ borderRadius: 14, backgroundColor: palette.surfaceSunken, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: palette.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1.2 }}>AUTODECK MEMBER</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Edit name" onPress={onEdit} hitSlop={8}>
              <Text style={{ color: palette.textSecondary, fontSize: 14, fontWeight: "600" }}>Edit name</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tiles.map((t) => (
          <Pressable key={t.label} accessibilityRole="button" onPress={t.onPress} style={({ pressed }) => ({ flexBasis: "47%", flexGrow: 1, borderRadius: 20, ...glassSurface, padding: 16, gap: 12, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: palette.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
              <Icon name={t.icon} color={palette.textPrimary} size={22} />
            </View>
            <Text style={{ color: palette.textPrimary, fontSize: 15, fontWeight: "600" }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

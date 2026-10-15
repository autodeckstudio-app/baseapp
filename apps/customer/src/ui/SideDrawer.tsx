import { Modal, Pressable, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { metrics } from "../lib/metrics";

export type DrawerItem = { key: string; label: string; sub?: string; icon: IconName; onPress: () => void };

/** Side drawer opened from the avatar: shortcuts to the rest of the app. */
export function SideDrawer({ open, onClose, name, initial, items }: { open: boolean; onClose: () => void; name: string; initial: string; items: DrawerItem[] }) {
  const { colors, name: mode } = useExperienceTheme();
  const day = mode === "light";
  const bg = day ? "#F6F2EA" : "#15161A";
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View accessibilityViewIsModal style={{ width: 296, maxWidth: "82%", backgroundColor: bg, paddingTop: 56, paddingBottom: 24, paddingHorizontal: metrics.cardPad, gap: metrics.innerGap, borderTopRightRadius: metrics.cardRadius, borderBottomRightRadius: metrics.cardRadius }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: metrics.innerGap }}>
            <View style={{ width: 48, height: 48, borderRadius: 9999, borderWidth: 2, borderColor: "#EC8638", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{name}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>AutoDeck member</Text>
            </View>
          </View>
          {items.map((it) => (
            <Pressable key={it.key} accessibilityRole="button" accessibilityLabel={it.label} onPress={() => { onClose(); it.onPress(); }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 48, opacity: pressed ? 0.6 : 1 })}>
              <Icon name={it.icon} color={colors.textPrimary} size={22} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{it.label}</Text>
                {it.sub ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{it.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} />
      </View>
    </Modal>
  );
}

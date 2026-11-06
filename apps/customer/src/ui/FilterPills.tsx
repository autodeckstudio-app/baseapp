import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** The one filter row: round pills, the picked one filled (ink in Day, white in Night). Used on Garage and Services. */
export function FilterPills<K extends string | null>({ items, value, onChange, trailing, pinned = true, fixedFirst = false, flat = false }: { items: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; trailing?: ReactNode; pinned?: boolean; fixedFirst?: boolean; flat?: boolean }) {
  const { name, colors: ink } = useExperienceTheme();
  const light = name === "light";
  const pill = (c: { key: K; label: string }) => {
    const on = value === c.key;
    // flat (Garage): plain text tab, the picked one underlined in gold; no pill fill.
    if (flat) {
      return (
        <Pressable key={c.key ?? "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} style={[{ minWidth: 0, paddingHorizontal: 2, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: on ? ink.premium : "transparent" }, items.length > 3 ? null : fixedFirst && c.key === items[0]?.key ? { flexGrow: 0, flexShrink: 0 } : { flexGrow: 0, flexShrink: 1, maxWidth: 160 }]}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[{ color: on ? ink.textPrimary : ink.textSecondary, fontSize: 14, fontWeight: on ? "800" : "600" }, items.length > 3 ? { maxWidth: 200 } : null]}>{c.label}</Text>
        </Pressable>
      );
    }
    return (
      <Pressable key={c.key ?? "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: on ? (light ? "#16181C" : "#665A4B") : "rgba(128,128,128,0.14)" }}>
        <Text style={{ color: on ? (light ? "#F4F1EC" : "#F5EDE2") : ink.textPrimary, fontSize: 13, fontWeight: "700" }}>{c.label}</Text>
      </Pressable>
    );
  };
  // fixedFirst (Garage): the first pill ("All") stays put at the left and only the rest scroll. Off by default, so Services is unchanged.
  const lockFirst = fixedFirst && pinned && !!trailing && items.length > 0;
  const scrolled = lockFirst ? items.slice(1) : items;
  const row = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {scrolled.map(pill)}
      {trailing && !pinned ? trailing : null}
    </ScrollView>
  );
  if (flat) {
    // Garage tabs: up to three share the row - "All" keeps natural width, car tabs shrink and ellipsize in place.
    // With more cars an equal split turns every label into a few letters, so the row scrolls with full labels instead.
    if (items.length <= 3) {
      return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, width: "100%" }}>
          {items.map(pill)}
          {trailing}
        </View>
      );
    }
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, width: "100%" }}>
        {fixedFirst && items.length > 0 ? pill(items[0]!) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 8 }}>
            {(fixedFirst ? items.slice(1) : items).map(pill)}
          </ScrollView>
        </View>
        {trailing}
      </View>
    );
  }
  if (!pinned || !trailing) return row;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {lockFirst ? pill(items[0]!) : null}
      <View style={{ flex: 1, minWidth: 0 }}>{row}</View>
      {trailing}
    </View>
  );
}

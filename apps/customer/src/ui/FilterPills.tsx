import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** The one filter row: round pills, the picked one filled (ink in Day, white in Night). Used on Garage and Services. */
export function FilterPills<K extends string | null>({ items, value, onChange, trailing, pinned = true, fixedFirst = false }: { items: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; trailing?: ReactNode; pinned?: boolean; fixedFirst?: boolean }) {
  const { name, colors: ink } = useExperienceTheme();
  const light = name === "light";
  const pill = (c: { key: K; label: string }) => {
    const on = value === c.key;
    return (
      <Pressable key={c.key ?? "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: on ? (light ? "#16181C" : "#F3F1ED") : "rgba(128,128,128,0.14)" }}>
        <Text style={{ color: on ? (light ? "#F4F1EC" : "#16181C") : ink.textPrimary, fontSize: 13, fontWeight: "700" }}>{c.label}</Text>
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
  if (!pinned || !trailing) return row;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {lockFirst ? pill(items[0]!) : null}
      <View style={{ flex: 1, minWidth: 0 }}>{row}</View>
      {trailing}
    </View>
  );
}

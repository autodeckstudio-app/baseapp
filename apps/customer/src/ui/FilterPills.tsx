import type { ReactNode } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** The one filter row: round pills, the picked one filled (ink in Day, white in Night). Used on Garage and Services. */
export function FilterPills<K extends string | null>({ items, value, onChange, trailing }: { items: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; trailing?: ReactNode }) {
  const { name, colors: ink } = useExperienceTheme();
  const light = name === "light";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {items.map((c) => {
        const on = value === c.key;
        return (
          <Pressable key={c.key ?? "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: on ? (light ? "#16181C" : "#F3F1ED") : "rgba(128,128,128,0.14)" }}>
            <Text style={{ color: on ? (light ? "#F4F1EC" : "#16181C") : ink.textPrimary, fontSize: 13, fontWeight: "700" }}>{c.label}</Text>
          </Pressable>
        );
      })}
      {trailing}
    </ScrollView>
  );
}

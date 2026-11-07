import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

/** The one filter row: round pills, the picked one filled (ink in Day, white in Night). Used on Garage and Services. */
export function FilterPills<K extends string | null>({ items, value, onChange, trailing, pinned = true, fixedFirst = false, flat = false }: { items: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; trailing?: ReactNode; pinned?: boolean; fixedFirst?: boolean; flat?: boolean }) {
  const { name, colors: ink } = useExperienceTheme();
  const light = name === "light";
  // Keep the picked pill visible: when the route (or swipe) changes the value, scroll it into view.
  const scrollRef = useRef<ScrollView>(null);
  const flatScrollRef = useRef<ScrollView>(null);
  const xs = useRef<Record<string, number>>({});
  const didInitialScroll = useRef(false);
  const scrollToKey = (k: K, animated: boolean) => {
    const x = xs.current[String(k ?? "all")];
    if (x === undefined || x === null) return;
    const target = Math.max(x - 16, 0);
    scrollRef.current?.scrollTo({ x: target, animated });
    flatScrollRef.current?.scrollTo({ x: target, animated });
  };
  useEffect(() => {
    // Value changed after mount (tap, swipe, back/forward): positions are known by now.
    scrollToKey(value, true);
  }, [value]);
  const onPillLayout = (k: K, x: number) => {
    xs.current[String(k ?? "all")] = x;
    // Cold mount / reload / deep link: effects can run before layout exists, so the
    // selected pill scrolls itself into view as soon as its position is known.
    if (k === value && !didInitialScroll.current) {
      didInitialScroll.current = true;
      scrollToKey(k, false);
    }
  };
  const pill = (c: { key: K; label: string }) => {
    const on = value === c.key;
    // flat (Garage): plain text tab, the picked one underlined in gold; no pill fill.
    if (flat) {
      // Full labels always: a car's make + model is its identity, never ellipsized. The row scrolls
      // when the labels do not fit, and the picked pill scrolls itself into view (scrollToKey).
      return (
        <Pressable key={c.key ?? "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} onLayout={(e) => onPillLayout(c.key, e.nativeEvent.layout.x)} style={{ paddingHorizontal: 2, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: on ? ink.premium : "transparent" }}>
          <Text numberOfLines={1} style={{ color: on ? ink.textPrimary : ink.textSecondary, fontSize: 14, fontWeight: on ? "800" : "600" }}>{c.label}</Text>
        </Pressable>
      );
    }
    return (
      <Pressable key={c.key ?? "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} onLayout={(e) => onPillLayout(c.key, e.nativeEvent.layout.x)} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: on ? (light ? "#16181C" : "#665A4B") : "rgba(128,128,128,0.14)" }}>
        <Text style={{ color: on ? (light ? "#F4F1EC" : "#F5EDE2") : ink.textPrimary, fontSize: 13, fontWeight: "700" }}>{c.label}</Text>
      </Pressable>
    );
  };
  // fixedFirst (Garage): the first pill ("All") stays put at the left and only the rest scroll. Off by default, so Services is unchanged.
  const lockFirst = fixedFirst && pinned && !!trailing && items.length > 0;
  const scrolled = lockFirst ? items.slice(1) : items;
  const row = (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {scrolled.map(pill)}
      {trailing && !pinned ? trailing : null}
    </ScrollView>
  );
  if (flat) {
    // Garage tabs: "All" (with fixedFirst) stays pinned at the left; car tabs keep their full
    // make + model labels and the row scrolls when they do not fit, so identity is never truncated.
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0, width: "100%" }}>
        {fixedFirst && items.length > 0 ? pill(items[0]!) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ScrollView ref={flatScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 8 }}>
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

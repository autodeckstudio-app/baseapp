// Garage showroom: the selected car as a full-width hero. Swipe sideways to change car; the photo moves
// slower than the card (parallax). Reduce Motion: no parallax, plain paging.
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import { segmentLabel } from "@autodeck/core";
import type { Vehicle } from "@autodeck/core";
import { CarThumb } from "./CarThumb";
import { Plate } from "./kit";
import { metrics } from "../lib/metrics";
import { useReduceMotion } from "../lib/reduce-motion";

const SHIFT = 28;

export function GarageShowroom({ cars, selectedId, onSelect, onOpen, chipFor }: { cars: Vehicle[]; selectedId: string; onSelect: (id: string) => void; onOpen: (v: Vehicle) => void; chipFor: (v: Vehicle) => React.ReactNode }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, cars.findIndex((c) => c.id === selectedId));
  useEffect(() => { if (w > 0) ref.current?.scrollTo({ x: index * w, animated: !reduce }); }, [index, w, reduce]);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return (
    <View onLayout={onLayout} style={{ gap: 10 }}>
      {w > 0 ? (
        <Animated.ScrollView
          ref={ref as never}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={reduce ? undefined : Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: false })}
          onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / w); const c = cars[i]; if (c && c.id !== selectedId) onSelect(c.id); }}
        >
          {cars.map((v, i) => {
            const shift = reduce ? 0 : x.interpolate({ inputRange: [(i - 1) * w, i * w, (i + 1) * w], outputRange: [SHIFT, 0, -SHIFT], extrapolate: "clamp" });
            const name = `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber;
            return (
              <Pressable key={v.id} accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={() => onOpen(v)} style={{ width: w }}>
                <View style={{ height: metrics.heroTall + 40, borderRadius: 24, overflow: "hidden", backgroundColor: "rgba(127,127,135,0.14)" }}>
                  <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: -SHIFT, width: w + SHIFT * 2, transform: [{ translateX: shift as never }] }}>
                    <CarThumb car={v} height={metrics.heroTall + 40} radius={0} />
                  </Animated.View>
                  <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.45)" }) }} />
                  <View style={{ position: "absolute", left: 16, right: 16, bottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>{name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Plate value={v.registrationNumber} />{segmentLabel(v.category) ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{segmentLabel(v.category)}</Text> : null}</View>
                    </View>
                    {chipFor(v)}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </Animated.ScrollView>
      ) : <View style={{ height: metrics.heroTall + 40 }} />}
      {cars.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }} accessibilityLabel={`Car ${index + 1} of ${cars.length}`}>
          {cars.map((c, i) => <View key={c.id} style={{ height: 6, width: i === index ? 18 : 6, borderRadius: 9999, backgroundColor: i === index ? "#EC8638" : "rgba(128,128,128,0.4)" }} />)}
        </View>
      ) : null}
    </View>
  );
}

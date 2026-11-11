import { SceneCard } from "./SceneCard";
// Garage floor: swipe sideways between cars. The focused car sits full size on a dark
// floor with its reflection; neighbours recede (smaller, dimmed) so the floor reads as
// depth. Tapping a car opens its room. 2D motion/depth, not a 3D model.
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { segmentLabel } from "@autodeck/core";
import type { Vehicle } from "@autodeck/core";
import { CarThumb } from "./CarThumb";
import { Plate } from "./kit";
import { metrics } from "../lib/metrics";
import { useReduceMotion } from "../lib/reduce-motion";

const GAP = 16;

export function CarPhotoCard({ car: v, height, badge, onOpen, chip }: { car: Vehicle; height: number; badge?: string | null; onOpen: (v: Vehicle) => void; chip?: React.ReactNode }) {
  const name = `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber;
  return (
    <SceneCard label={`Open ${name}`} onPress={() => onOpen(v)}>
      <View style={{ height, borderRadius: 24, borderWidth:1,borderColor:"rgba(180,180,190,0.20)", overflow: "hidden", backgroundColor: "rgba(127,127,135,0.14)" }}>
        <CarThumb car={v} height={height} radius={0} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(height * 0.62), ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.45)" }) }} />
        {badge ? (
          <View style={{ position: "absolute", left: 12, top: 12, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.88)" }}>
            <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: "#EC8638" }} />
            <Text numberOfLines={1} style={{ color: "#1D1B26", fontSize: 11, fontWeight: "800" }}>{badge}</Text>
          </View>
        ) : null}
        <View style={{ position: "absolute", left: 18, right: 18, bottom: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 20, letterSpacing:-0.4, fontWeight: "700" }}>{name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Plate value={v.registrationNumber} />{segmentLabel(v.category) ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{segmentLabel(v.category)}</Text> : null}</View>
          </View>
        </View>
        {chip ? <View style={{ position: "absolute", right: 12, top: 12 }}>{chip}</View> : null}
      </View>
    </SceneCard>
  );
}

/** One car card: hero photo with identity overlaid, or a compact card when the car has no photo yet. Used by the stacked garage list. */
export function FloorCar({ car: v, width, height, focused, onOpen, chip }: { car: Vehicle; width: number | "100%"; height: number; focused: boolean; onOpen: (v: Vehicle) => void; chip?: React.ReactNode }) {
  const name = `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber;
  // A car with no photo yet gets a compact card: a short thumb band keeps the
  // truthful empty state, and identity lives in a solid dark bar BELOW it - no
  // overlay collisions, name and plate always fully readable. The full hero
  // height with the photo gradient is earned by a real photo.
  if (!v.photoUrl) {
    // Compact identity row, same grammar as the Home car card: a small glyph tile
    // beside name, plate and segment. No full-width grey slab pretending to be a photo.
    return (
      <SceneCard label={`Open ${name}`} onPress={() => onOpen(v)}>
        <View style={{ width, opacity: focused ? 1 : 0.72, transform: [{ scale: focused ? 1 : 0.94 }] }}>
          <View style={{ borderRadius: 24, borderWidth:1, borderColor:"rgba(180,180,190,0.20)", backgroundColor: "rgba(20,20,26,0.92)", paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <CarThumb car={v} height={56} width={56} radius={16} />
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, color: "#FFFFFF", fontSize: 16, letterSpacing:-0.2, fontWeight: "700" }}>{name}</Text>
                {chip ? <View style={{ flexShrink: 0 }}>{chip}</View> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Plate value={v.registrationNumber} />{segmentLabel(v.category) ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{segmentLabel(v.category)}</Text> : null}</View>
            </View>
          </View>
        </View>
      </SceneCard>
    );
  }
  return (
    <SceneCard label={`Open ${name}`} onPress={() => onOpen(v)}>
      <View style={{ width, opacity: focused ? 1 : 0.72, transform: [{ scale: focused ? 1 : 0.94 }] }}>
        <View style={{ height, borderRadius: 24, borderWidth:1,borderColor:"rgba(180,180,190,0.20)", overflow: "hidden", backgroundColor: "rgba(127,127,135,0.14)" }}>
          <CarThumb car={v} height={height} radius={0} />
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(height * 0.62), ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.78) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.45)" }) }} />
          <View style={{ position: "absolute", left: 16, right: 16, bottom: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 20, letterSpacing:-0.4, fontWeight: "700" }}>{name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Plate value={v.registrationNumber} />{segmentLabel(v.category) ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{segmentLabel(v.category)}</Text> : null}</View>
            </View>
          </View>
          {chip ? <View style={{ position: "absolute", right: 12, top: 12 }}>{chip}</View> : null}
        </View>
      </View>
    </SceneCard>
  );
}

/** A measured, touch-scrollable row. Brand filtering is owned by GarageScreen. */
export function GarageShowroom({ cars, selectedId, onOpen, onSelect, chipFor }: { cars: Vehicle[]; selectedId?: string | null; onSelect?: (id: string) => void; onOpen: (v: Vehicle) => void; chipFor: (v: Vehicle) => React.ReactNode }) {
  const { width: winW } = useWindowDimensions();
  const [available, setAvailable] = useState(Math.max(240, winW - 40));
  const [focusIdx, setFocusIdx] = useState(Math.max(0, cars.findIndex(c => c.id === selectedId)));
  const scrollRef = useRef<ScrollView>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = useReduceMotion();
  useEffect(() => () => { if (snapTimer.current) clearTimeout(snapTimer.current); }, []);
  const cardW = Math.max(200, Math.min(available - (cars.length > 1 ? 24 : 0), 720));
  const interval = cardW + GAP;
  const index = Math.min(focusIdx, Math.max(0, cars.length - 1));
  const focusedId = cars[index]?.id;
  const ids = cars.map(c => c.id).join("|");
  useEffect(() => {
    const next = Math.max(0, cars.findIndex(c => c.id === selectedId));
    setFocusIdx(next);
    if (cars[next]) onSelect?.(cars[next]!.id);
    scrollRef.current?.scrollTo({ x: next * interval, animated: false });
  }, [selectedId, ids, interval]);
  const move = (i: number) => {
    const next = Math.max(0, Math.min(cars.length - 1, i));
    setFocusIdx(next);
    scrollRef.current?.scrollTo({ x: next * interval, animated: !reduce });
    onSelect?.(cars[next]!.id);
  };
  if (!cars.length) return null;
  return (
    <View testID="garage-carousel" style={{ width: "100%", minWidth: 0, gap: 10 }} onLayout={e => {
      const width = e.nativeEvent.layout.width;
      if (width > 0) setAvailable(width);
    }}>
      <ScrollView
        testID="garage-car-scroll"
        accessibilityLabel="Your cars. Swipe left or right to browse."
        ref={scrollRef}
        horizontal
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        scrollEnabled={cars.length > 1}
        style={{ width: "100%" }}
        contentContainerStyle={{ gap: GAP, paddingRight: Math.max(0, available - cardW) }}
        scrollEventThrottle={16}
        onScroll={e => {
          const i = Math.max(0, Math.min(cars.length - 1, Math.round(e.nativeEvent.contentOffset.x / interval)));
          setFocusIdx(i);
          if (snapTimer.current) clearTimeout(snapTimer.current);
          const x = e.nativeEvent.contentOffset.x;
          snapTimer.current = setTimeout(() => {
            if (Math.abs(x - i * interval) > 2) scrollRef.current?.scrollTo({ x: i * interval, animated: !reduce });
          }, 150);
          if (cars[i] && cars[i]!.id !== focusedId) onSelect?.(cars[i]!.id);
        }}
      >
        {cars.map(v => <FloorCar key={v.id} car={v} width={cardW} height={metrics.heroTall + 40} focused={v.id === focusedId} onOpen={onOpen} chip={chipFor(v)} />)}
      </ScrollView>
      {cars.length > 1 ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous car" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => move(index - 1)} style={{ padding: 10, minHeight: 44, minWidth: 72, justifyContent: "center", opacity: index === 0 ? 0.35 : 1 }}><Text style={{ color: "#EC8638", fontWeight: "700" }}>Previous</Text></Pressable>
        <Text accessibilityLiveRegion="polite" style={{ color: "#898990", fontSize: 12 }}>{index + 1} / {cars.length}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next car" accessibilityState={{ disabled: index === cars.length - 1 }} disabled={index === cars.length - 1} onPress={() => move(index + 1)} style={{ padding: 10, minHeight: 44, minWidth: 72, justifyContent: "center", opacity: index === cars.length - 1 ? 0.35 : 1 }}><Text style={{ color: "#EC8638", fontWeight: "700" }}>Next</Text></Pressable>
      </View> : null}
    </View>
  );
}

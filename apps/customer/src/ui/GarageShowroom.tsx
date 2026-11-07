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

const GAP = 16;
const PEEK = 28; // how much of the next car shows at the edge, signalling the swipe

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
    return (
      <SceneCard label={`Open ${name}`} onPress={() => onOpen(v)}>
        <View style={{ width, opacity: focused ? 1 : 0.72, transform: [{ scale: focused ? 1 : 0.94 }] }}>
          <View style={{ borderRadius: 24, borderWidth:1, borderColor:"rgba(180,180,190,0.20)", overflow: "hidden", backgroundColor: "rgba(127,127,135,0.14)" }}>
            <CarThumb car={v} height={88} radius={0} />
            <View style={{ backgroundColor: "rgba(20,20,26,0.92)", paddingHorizontal: 14, paddingVertical: 12, gap: 6 }}>
              <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 16, letterSpacing:-0.2, fontWeight: "700" }}>{name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}><Plate value={v.registrationNumber} />{segmentLabel(v.category) ? <Text style={{ color: "#E4E2DF", fontSize: 12 }}>{segmentLabel(v.category)}</Text> : null}</View>
            </View>
            {chip ? <View style={{ position: "absolute", right: 12, top: 12 }}>{chip}</View> : null}
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

export function GarageShowroom({ cars, selectedId, onOpen, onSelect, chipFor }: { cars: Vehicle[]; selectedId?: string | null; onSelect?: (id: string) => void; onOpen: (v: Vehicle) => void; chipFor: (v: Vehicle) => React.ReactNode }) {
  const { width: winW } = useWindowDimensions();
  const cardW = Math.min(winW - PEEK * 2, 480);
  const interval = cardW + GAP;
  const heroH = metrics.heroTall + 40;
  const scrollRef = useRef<ScrollView>(null);
  // Focus follows the swipe locally; a selection from outside (the car list) moves the floor.
  const controlled = selectedId !== null && selectedId !== undefined;
  const initialIdx = Math.max(0, cars.findIndex((c) => c.id === (selectedId ?? cars[0]?.id)));
  const [focusIdx, setFocusIdx] = useState(initialIdx);
  const scrollX = useRef(initialIdx * interval);
  const snapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusId = cars[focusIdx]?.id ?? cars[0]?.id;
  useEffect(() => () => { if (snapT.current) clearTimeout(snapT.current); }, []);
  useEffect(() => {
    if (!controlled) return;
    const i = Math.max(0, cars.findIndex((c) => c.id === selectedId));
    setFocusIdx(i);
    scrollX.current = i * interval;
    scrollRef.current?.scrollTo({ x: i * interval, animated: true });
  }, [selectedId]);
  if (cars.length === 0) return null;
  if (cars.length === 1) {
    const v = cars[0]!;
    return <FloorCar car={v} width={Math.min(winW, 536)} height={heroH} focused onOpen={onOpen} chip={chipFor(v)} />;
  }
  return (
    <View style={{ marginHorizontal: -PEEK }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: GAP, paddingHorizontal: PEEK }}
        scrollEventThrottle={16}
        onLayout={() => scrollRef.current?.scrollTo({ x: initialIdx * interval, animated: false })}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
          const i = Math.max(0, Math.min(cars.length - 1, Math.round(scrollX.current / interval)));
          if (i !== focusIdx) {
            setFocusIdx(i);
            if (controlled) onSelect?.(cars[i]!.id);
          }
          // Snap after the scroll goes quiet: RN web does not fire momentum-end reliably.
          if (snapT.current) clearTimeout(snapT.current);
          snapT.current = setTimeout(() => {
            const target = Math.max(0, Math.min(cars.length - 1, Math.round(scrollX.current / interval))) * interval;
            if (Math.abs(target - scrollX.current) > 2) scrollRef.current?.scrollTo({ x: target, animated: true });
          }, 140);
        }}
      >
        {cars.map((v) => (
          <FloorCar key={v.id} car={v} width={cardW} height={heroH} focused={v.id === focusId} onOpen={onOpen} chip={chipFor(v)} />
        ))}
      </ScrollView>
    </View>
  );
}

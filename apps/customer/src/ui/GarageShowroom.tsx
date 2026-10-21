// Garage showroom: the selected car as one full-width hero photo. Changing car is done with the chips above only (no swipe, no dots).
import { Platform, Pressable, Text, View } from "react-native";
import { segmentLabel } from "@autodeck/core";
import type { Vehicle } from "@autodeck/core";
import { CarThumb } from "./CarThumb";
import { Plate } from "./kit";
import { metrics } from "../lib/metrics";

export function CarPhotoCard({ car: v, height, badge, onOpen, chip, photo }: { car: Vehicle; height: number; badge?: string | null; onOpen: (v: Vehicle) => void; chip?: React.ReactNode; photo?: React.ReactNode }) {
  const name = `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={() => onOpen(v)}>
      <View style={{ height, borderRadius: 24, overflow: "hidden", backgroundColor: "rgba(127,127,135,0.14)" }}>
        {photo ?? <CarThumb car={v} height={height} radius={0} />}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.45)" }) }} />
        {badge ? (
          <View style={{ position: "absolute", left: 12, top: 12, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.88)" }}>
            <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: "#EC8638" }} />
            <Text numberOfLines={1} style={{ color: "#1D1B26", fontSize: 11, fontWeight: "800" }}>{badge}</Text>
          </View>
        ) : null}
        <View style={{ position: "absolute", left: 14, right: 14, bottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>{name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Plate value={v.registrationNumber} />{segmentLabel(v.category) ? <View style={{ borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "rgba(20,20,24,0.62)" }}><Text style={{ color: "#F1EFEC", fontSize: 12, fontWeight: "600" }}>{segmentLabel(v.category)}</Text></View> : null}</View>
          </View>
          {chip}
        </View>
      </View>
    </Pressable>
  );
}

export function GarageShowroom({ cars, selectedId, onOpen, chipFor }: { cars: Vehicle[]; selectedId: string; onSelect?: (id: string) => void; onOpen: (v: Vehicle) => void; chipFor: (v: Vehicle) => React.ReactNode }) {
  const v = cars.find((c) => c.id === selectedId) ?? cars[0];
  if (!v) return null;
  const name = `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name}`} onPress={() => onOpen(v)}>
      <View style={{ height: metrics.heroTall + 40, borderRadius: 24, overflow: "hidden", backgroundColor: "rgba(127,127,135,0.14)" }}>
        <CarThumb car={v} height={metrics.heroTall + 40} radius={0} />
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
}

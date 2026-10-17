// Garage showroom: the selected car as one full-width hero photo. Changing car is done with the chips above only (no swipe, no dots).
import { Platform, Pressable, Text, View } from "react-native";
import { segmentLabel } from "@autodeck/core";
import type { Vehicle } from "@autodeck/core";
import { CarThumb } from "./CarThumb";
import { Plate } from "./kit";
import { metrics } from "../lib/metrics";

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

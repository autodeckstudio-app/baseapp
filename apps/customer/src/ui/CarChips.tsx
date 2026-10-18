// The car on Home: one card with the active car (photo, name, plate, size). With several cars a row of small names switches the active one.
// Tap the car to open it in Garage.
import { Pressable, ScrollView, Text, View } from "react-native";
import { segmentLabel } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { metrics } from "../lib/metrics";
import { Plate } from "./kit";
import { CarThumb } from "./CarThumb";
import type { HomeCar } from "./HomeView";

export function CarChips({ cars, active, onActive, onOpen, onAdd }: { cars: HomeCar[]; active: number; onActive: (i: number) => void; onOpen: (c: HomeCar) => void; onAdd: () => void }) {
  const { name, colors } = useExperienceTheme();
  const light = name === "light";
  if (cars.length === 0) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Add a car" onPress={onAdd} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: metrics.cardPad, ...glassPane(light) }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>Add your car</Text>
      </Pressable>
    );
  }
  const car = cars[Math.min(active, cars.length - 1)] ?? cars[0]!;
  const seg = segmentLabel(car.category ?? car.vehicle?.category);
  return (
    <View style={{ padding: metrics.cardPad, gap: 12, ...glassPane(light) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${car.title}`} onPress={() => onOpen(car)} style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.88 : 1 })}>
        <View style={{ borderRadius: 16, overflow: "hidden" }}><CarThumb car={car.vehicle} height={160} radius={16} /></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "800" }}>{car.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {car.plate ? <Plate value={car.plate} /> : null}
              {seg ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{seg}</Text> : null}
            </View>
          </View>
        </View>
      </Pressable>
      {cars.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {cars.map((c, i) => {
            const on = i === active;
            return (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Select ${c.title}`} accessibilityState={{ selected: on }} onPress={() => onActive(i)}
                style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? colors.textPrimary : "rgba(128,128,128,0.14)" }}>
                <Text numberOfLines={1} style={{ color: on ? (light ? "#F4F1EC" : "#16181C") : colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{c.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

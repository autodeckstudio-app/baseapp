// The car on Home: a compact glass chip (photo, name, plate, size). Several cars scroll sideways.
// Tap a chip to make it the active car; tap the active chip to open it in Garage.
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
  const one = cars.length === 1;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={!one} contentContainerStyle={{ gap: 10, flexGrow: one ? 1 : 0 }}>
      {cars.map((c, i) => {
        const seg = segmentLabel(c.category ?? c.vehicle?.category);
        const on = one || i === active;
        return (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={on ? `Open ${c.title}` : `Select ${c.title}`} accessibilityState={{ selected: on }} onPress={() => (on ? onOpen(c) : onActive(i))}
            style={({ pressed }) => ({ flex: one ? 1 : undefined, minWidth: one ? 0 : 250, flexDirection: "row", alignItems: "center", gap: 12, padding: 10, opacity: pressed ? 0.85 : on ? 1 : 0.6, ...glassPane(light) })}>
            <View style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden" }}><CarThumb car={c.vehicle} height={52} width={52} radius={12} /></View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "800" }}>{c.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {c.plate ? <Plate value={c.plate} /> : null}
                {seg ? <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{seg}</Text> : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

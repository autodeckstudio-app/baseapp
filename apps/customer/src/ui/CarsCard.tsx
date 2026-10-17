import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { CarListingView } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { hasCarPrice } from "../lib/cars-home";
import { inr, kmLabel } from "../lib/carsale-service";

/** Home section "Cars for sale": every live listing in a sideways scrolling list, then Buy and Sell. Real photos only. */
export function CarsCard({ cars, onOpen, onBuy, onSell }: { cars: CarListingView[]; onOpen: (id: string) => void; onBuy: () => void; onSell: () => void }) {
  const day = useExperienceTheme().name === "light";
  const ink = day ? "#1D1B26" : "#FAF8F5";
  const sub = day ? "#4A4756" : "#D5D1CA";
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Cars</Text>
          <Text accessibilityRole="header" style={{ color: ink, fontSize: 19, fontWeight: "800" }}>Cars for sale</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="See all cars for sale" onPress={onBuy} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: ink, fontSize: 14, fontWeight: "700" }}>See all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }} style={{ marginHorizontal: -2 }}>
        {cars.map((car) => (
          <Pressable key={car.id} accessibilityRole="button" accessibilityLabel={`View ${car.year} ${car.make} ${car.model}`} onPress={() => onOpen(car.id)} style={{ width: 260, overflow: "hidden", ...glassPane(day) }}>
            <View style={{ aspectRatio: 4 / 3, backgroundColor: "#202023" }}>
              <Image source={{ uri: car.photoUrls[0] }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
            </View>
            <View style={{ padding: 14, gap: 4 }}>
              <Text numberOfLines={1} style={{ color: ink, fontSize: 16, fontWeight: "800" }}>{car.year} {car.make} {car.model}</Text>
              <Text numberOfLines={1} style={{ color: sub, fontSize: 13 }}>{kmLabel(car.kmDriven)}</Text>
              <Text style={{ color: ink, fontSize: 15, fontWeight: "800" }}>{hasCarPrice(car) ? inr(car.askingPrice) : "Price on request"}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ k: "buy", label: "Buy a car", on: onBuy, primary: true }, { k: "sell", label: "Sell your car", on: onSell, primary: false }].map((b) => (
          <Pressable key={b.k} accessibilityRole="button" accessibilityLabel={b.label} onPress={b.on} style={({ pressed }) => ({ flex: 1, minWidth: 0, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: b.primary ? (day ? "#1D1B26" : "#FAF8F5") : day ? "rgba(29,27,38,0.06)" : "rgba(255,255,255,0.10)", opacity: pressed ? 0.85 : 1 })}>
            <Text numberOfLines={1} style={{ color: b.primary ? (day ? "#FFFFFF" : "#1D1B26") : ink, fontSize: 14, fontWeight: "700" }}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

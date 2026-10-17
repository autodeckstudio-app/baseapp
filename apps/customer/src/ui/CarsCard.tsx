import { Image, Pressable, Text, View } from "react-native";
import type { CarListingView } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { hasCarPrice } from "../lib/cars-home";
import { inr, kmLabel } from "../lib/carsale-service";

/** Home marketing card for buying and selling cars. Real photo of a live listing, two actions, nothing else. */
export function CarsCard({ car, onBuy, onSell }: { car: CarListingView; onBuy: () => void; onSell: () => void }) {
  const day = useExperienceTheme().name === "light";
  const ink = day ? "#1D1B26" : "#FAF8F5";
  const sub = day ? "#4A4756" : "#D5D1CA";
  return (
    <View style={{ overflow: "hidden", ...glassPane(day) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${car.year} ${car.make} ${car.model}`} onPress={onBuy} style={{ aspectRatio: 16 / 9, backgroundColor: "#202023" }}>
        <Image source={{ uri: car.photoUrls[0] }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexShrink: 1, backgroundColor: "rgba(10,10,12,0.72)", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>{car.year} {car.make} {car.model} · {kmLabel(car.kmDriven)}</Text>
          </View>
          <View style={{ backgroundColor: "rgba(10,10,12,0.72)", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{hasCarPrice(car) ? inr(car.askingPrice) : "Ask price"}</Text>
          </View>
        </View>
      </Pressable>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Cars</Text>
          <Text style={{ color: ink, fontSize: 17, fontWeight: "800" }}>Buy or sell a car with AutoDeck</Text>
          <Text style={{ color: sub, fontSize: 13 }}>Real photos, clear facts, enquiries handled by the studio.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[{ k: "buy", label: "Buy a car", on: onBuy, primary: true }, { k: "sell", label: "Sell your car", on: onSell, primary: false }].map((b) => (
            <Pressable key={b.k} accessibilityRole="button" accessibilityLabel={b.label} onPress={b.on} style={({ pressed }) => ({ flex: 1, minWidth: 0, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1, backgroundColor: b.primary ? (day ? "#1D1B26" : "#FAF8F5") : "transparent", borderWidth: b.primary ? 0 : 1, borderColor: day ? "rgba(29,27,38,0.28)" : "rgba(255,255,255,0.3)" })}>
              <Text numberOfLines={1} style={{ color: b.primary ? (day ? "#FAF8F5" : "#1D1B26") : ink, fontSize: 14, fontWeight: "700" }}>{b.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

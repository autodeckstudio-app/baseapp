// Category portrait fallback for a car with no uploaded photo. Owner decision
// (Nov 7, 2026, WhatsApp wamid.HBgMOTE5MDk5Nzk2ODExFQIAEhgUM0ExMDMzNDgzQUQ0MjU1NzYwQ0IA,
// verbatim: "Instead of 3d model there should be car images"). The imagery manifest
// in lib/imagery owns which verified car portrait each category shows; customers'
// own photos still come first wherever they exist. A category portrait is honest
// stock, not the customer's car, so it always carries a visible "Illustrative ..."
// label; the label never appears on the customer's own photo because this
// component only renders when there is none. A category with no verified portrait
// (or none set) fails closed to the neutral car icon - never a photo of the wrong
// kind of vehicle.
import { Image, Text, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { VehicleCategory } from "@autodeck/core";
import { vehicleImagery } from "../lib/imagery";

export function CategoryCarImage({ category, height }: { category?: VehicleCategory | string | null; height: number }) {
  const source = category && category in vehicleImagery ? vehicleImagery[category as VehicleCategory] : undefined;
  if (!source) {
    return (
      <View style={{ width: "100%", height, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(127,127,135,0.14)" }}>
        <Icon name="car" color="#8A8A92" size={Math.max(28, Math.min(56, height / 4))} />
      </View>
    );
  }
  const kind = String(category).toLowerCase() === "suv" ? "SUV" : String(category).toLowerCase();
  const label = `Illustrative ${kind} image`;
  return (
    <View style={{ width: "100%", height }}>
      <Image source={source} accessibilityLabel={label} resizeMode="cover" style={{ width: "100%", height }} />
      <View style={{ position: "absolute", left: 10, bottom: 10, backgroundColor: "rgba(18,18,22,0.72)", borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ color: "#F2F0EC", fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>{label}</Text>
      </View>
    </View>
  );
}

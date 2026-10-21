// Dev-only mock of the Cars screen: the real CarsHub with sample listings. Photos are stand-ins, not customer data.
import type { CarListingView } from "@autodeck/core";
import { Text, View } from "react-native";
import { CarsHub } from "../ui/CarsHub";

const mk = (id: string, make: string, model: string, year: number, fuel: string, km: number, price: number, source: "studio" | "customer", photo: string): CarListingView =>
  ({ id, make, model, year, fuel, kmDriven: km, askingPrice: price * 100, createdAt: "2026-10-2" + (id === "a" ? "9" : id === "b" ? "8" : "7"), source, status: "live", photoUrls: [photo], gearbox: "manual", variant: null, area: null } as unknown as CarListingView);
const raw = require("../../assets/imagery/generated/garage-inspection.jpg");
const img: string = typeof raw === "string" ? raw : raw?.uri ?? raw?.default?.uri ?? raw?.default;
const cars = [
  mk("a", "Tata", "Safari", 2023, "diesel", 58128, 1111000, "studio", img),
  mk("b", "Kia", "Seltos", 2022, "diesel", 41000, 1350000, "customer", img),
  mk("c", "Hyundai", "Grand i10", 2018, "petrol", 62500, 451000, "customer", img),
];
export default function PreviewCars() {
  if (!__DEV__) return null;
  return <CarsHub header={<View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: "#1D1B26", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>A</Text></View><Text style={{ fontSize: 17, fontWeight: "800", color: "#1D1B26" }}>Cars</Text><View style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: "#fff" }} /></View>} all={cars} mine={[]} error={false} onRetry={() => undefined} onOpen={() => undefined} onSell={() => undefined} />;
}

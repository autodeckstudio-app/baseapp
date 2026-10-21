// Dev-only mock of the Cars screen: the real CarsHub, real app bar and real bottom nav with sample listings.
// Photos are stand-ins and the cars are NOT real listings.
import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { CarListingView } from "@autodeck/core";
import { CarsHub } from "../ui/CarsHub";
import { RaisedTabBar } from "../ui/RaisedTabBar";

const mk = (id: string, make: string, model: string, year: number, fuel: string, km: number, price: number, source: "studio" | "customer", photo: string, status = "live"): CarListingView =>
  ({ id, make, model, year, fuel, kmDriven: km, askingPrice: price * 100, createdAt: "2026-10-2" + (id === "a" ? "9" : id === "b" ? "8" : "7"), source, status, photoUrls: [photo], gearbox: "manual", variant: null, area: null } as unknown as CarListingView);
const raw = require("../../assets/imagery/generated/garage-inspection.jpg");
const img: string = typeof raw === "string" ? raw : raw?.uri ?? raw?.default?.uri ?? raw?.default;
const cars = [
  mk("a", "Tata", "Safari", 2023, "diesel", 58128, 1111000, "studio", img),
  mk("b", "Kia", "Seltos", 2022, "diesel", 41000, 1350000, "customer", img),
  mk("c", "Hyundai", "Grand i10", 2018, "petrol", 62500, 451000, "customer", img),
];
const mine = [mk("m", "Honda", "City", 2019, "petrol", 48000, 780000, "customer", img, "pending")];
const noop = () => undefined;
export default function PreviewCars() {
  const q = useLocalSearchParams<{ tab?: string; more?: string; empty?: string }>();
  const [log, setLog] = useState("");
  if (!__DEV__) return null;
  const names = ["bookings", "catalogue", "index", "garage", "profile", "cars"];
  const state = { index: 5, routes: names.map((n) => ({ key: n, name: n })) };
  const descriptors = Object.fromEntries(names.map((n) => [n, { options: n === "cars" ? { href: null } : {} }]));
  return (
    <View style={{ flex: 1 }}>
      <CarsHub all={q.empty ? [] : cars} mine={mine} error={false} initialTab={q.tab === "sell" ? "sell" : "buy"} initialFiltersOpen={!!q.more} onRetry={noop} onOpen={(id) => setLog(`opened car ${id}`)} onSell={() => setLog("sell flow opened")} />
      {log ? <Text accessibilityLabel="press-log" style={{ position: "absolute", top: 0, left: 0, fontSize: 10, color: "#0a0" }}>{log}</Text> : null}
      <RaisedTabBar state={state} descriptors={descriptors} navigation={{ navigate: noop, emit: () => ({ defaultPrevented: false }) }} icons={{ index: "home", catalogue: "services", bookings: "bookings", garage: "garage", profile: "profile" }} />
    </View>
  );
}

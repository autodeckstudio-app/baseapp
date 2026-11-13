// Site app-mockup capture harness: real current customer components, synthetic data,
// framed at true iPhone proportions (390x844 incl. 59px status strip + 34px home strip).
import React from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";
import { ExperienceThemeProvider } from "../../../packages/ui/src/native/ThemeContext";
import { applyCustomerRaisedTheme } from "@autodeck/ui/theme";
import { applyCustomerSoftNight } from "../../../apps/customer/src/lib/customer-night";
import { setSurfaceMode, } from "../../../apps/customer/src/lib/glass";
import { raised } from "../../../apps/customer/src/lib/raised";
import { LiquidAmbient } from "@autodeck/ui/native";
import { HomeView } from "../../../apps/customer/src/ui/HomeView";
import BookingsScreen from "../../../apps/customer/src/app/(tabs)/bookings/index";
import GarageScreen from "../../../apps/customer/src/app/(tabs)/garage/index";
import ProfileScreen from "../../../apps/customer/src/app/(tabs)/profile";
import { CarsHub } from "../../../apps/customer/src/ui/CarsHub";
import { RaisedTabBar } from "../../../apps/customer/src/ui/RaisedTabBar";
import { __params } from "expo-router";
import type { CarListingView } from "@autodeck/core";

applyCustomerRaisedTheme();
applyCustomerSoftNight();
setSurfaceMode("light");

const q = new URLSearchParams(location.search);
__params.current = Object.fromEntries(q.entries());
const noop = () => undefined;
const screen = q.get("screen") || "home";

const TAB_NAMES = ["bookings", "catalogue", "index", "garage", "profile"];
const TAB_ICONS = { index: "home", catalogue: "services", bookings: "bookings", garage: "garage", profile: "profile" } as any;
const tabProps = (index: number, extra?: string) => {
  const names = extra ? [...TAB_NAMES, extra] : TAB_NAMES;
  return {
    state: { index, routes: names.map((n) => ({ key: n, name: n })) },
    descriptors: Object.fromEntries(names.map((n) => [n, { options: n === extra ? { href: null } : {} }])),
    navigation: { navigate: noop, emit: () => ({ defaultPrevented: false }) },
    icons: TAB_ICONS,
  } as any;
};

const mkCar = (id: string, make: string, model: string, year: number, fuel: string, km: number): CarListingView =>
  ({ id, make, model, year, fuel, kmDriven: km, askingPrice: 0, priceHidden: true, createdAt: "2026-10-2" + id, source: id === "a" ? "studio" : "customer", status: "live", photoUrls: [], gearbox: "manual", variant: null, area: null } as unknown as CarListingView);
const saleCars = [mkCar("a", "Sample", "SUV", 2023, "diesel", 24000), mkCar("b", "Sample", "hatchback", 2022, "petrol", 31000), mkCar("c", "Sample", "crossover", 2024, "petrol", 12000)];

const homeProps: any = {
  greeting: "Good afternoon, Alex", initial: "A", unread: 0,
  cars: [{ id: "car-a", title: "Sample car", plate: "SAMPLE", category: "suv" }],
  services: [
    { id: "wash", category: "washing", name: "Regular wash", price: "₹500" },
    { id: "ceramic", category: "ceramic", name: "Ceramic coating", price: "Quote on request" },
    { id: "garage", category: "garage", name: "Garage check", price: "₹999" },
    { id: "inspect", category: "inspection", name: "Inspection", price: "₹999" },
  ],
  reminders: [],
  live: { kicker: "In the studio", title: "Work under way", detail: "Sample car · Since 1:29 pm", onPress: noop },
  progress: 45,
  membership: { title: "Membership, 6 washes", detail: "left, until Mon, 30 Nov" },
  studio: { address: "Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge, Ahmedabad 380006", hours: "Mon to Sat, 10 am to 9 pm. Sunday, 10 am to 7 pm", openText: "Open now, until 9 pm", open: true },
  quick: [{ key: "call", label: "Call", icon: "call", onPress: noop }, { key: "wa", label: "WhatsApp", icon: "whatsapp", onPress: noop }, { key: "dir", label: "Directions", icon: "directions", onPress: noop }],
  social: [{ key: "ch", title: "Our channel", sub: "WhatsApp", icon: "channel", onPress: noop }, { key: "ig", title: "@autodeck.studio", sub: "Instagram", icon: "instagram", onPress: noop }],
  onAvatar: noop, onSearch: noop, onBell: noop, onAllServices: noop, onCategory: noop, onService: noop,
  onCar: noop, onAddCar: noop, onGarage: noop, onReminders: noop, onBook: noop, onStudio: noop,
  onMembership: noop, onVisits: noop, onShare: noop,
};

const ground = raised("light");
const Frame = ({ children, tab }: { children: React.ReactNode; tab: React.ReactNode }) => (
  <div style={{ width: 390, height: 844, position: "relative", overflow: "hidden", backgroundColor: ground.ground, backgroundImage: (ground as any).groundImage }}>
    <div style={{ position: "absolute", top: 59, left: 0, right: 0, bottom: 34 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>{children}</div>
      {tab}
    </div>
  </div>
);

let body: React.ReactNode = null;
let tab: React.ReactNode = null;
if (screen === "home") {
  body = <LiquidAmbient><main style={{ padding: "0 16px", boxSizing: "border-box" }}><HomeView {...homeProps} /></main></LiquidAmbient>;
  tab = <RaisedTabBar {...tabProps(2)} />;
} else if (screen === "bookings") {
  body = <BookingsScreen />;
  tab = <RaisedTabBar {...tabProps(0)} />;
} else if (screen === "garage") {
  body = <GarageScreen />;
  tab = <RaisedTabBar {...tabProps(3)} />;
} else if (screen === "cars") {
  body = <CarsHub all={saleCars} mine={[]} error={false} initialTab="buy" onRetry={noop} onOpen={noop} onSell={noop} />;
  tab = <RaisedTabBar {...tabProps(5, "cars")} />;
} else if (screen === "profile") {
  body = <ProfileScreen />;
  tab = <RaisedTabBar {...tabProps(4)} />;
}

createRoot(document.getElementById("root")!).render(
  <ExperienceThemeProvider name="light">
    <Frame tab={tab}>
      <View style={{ flex: 1 }}>{body}</View>
    </Frame>
  </ExperienceThemeProvider>
);

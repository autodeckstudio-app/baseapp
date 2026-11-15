// Dev-only: the real Garage screen with sample cars (?mock=1 inside the screen), real app bar and real bottom nav. Params: live=1, pick=a, empty=1.
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import GarageScreen from "./(tabs)/garage/index";
import { RaisedTabBar } from "../ui/RaisedTabBar";

const noop = () => undefined;
export default function PreviewGarage() {
  const q = useLocalSearchParams(); void q;
  if (!__DEV__) return null;
  const names = ["bookings", "catalogue", "index", "garage", "profile"];
  const state = { index: 3, routes: names.map((n) => ({ key: n, name: n })) };
  const descriptors = Object.fromEntries(names.map((n) => [n, { options: {} }]));
  return (
    <View style={{ flex: 1 }}>
      <GarageScreen />
      <RaisedTabBar state={state} descriptors={descriptors} navigation={{ navigate: noop, emit: () => ({ defaultPrevented: false }) }} icons={{ index: "home", catalogue: "services", bookings: "bookings", garage: "garage", profile: "profile" }} />
    </View>
  );
}

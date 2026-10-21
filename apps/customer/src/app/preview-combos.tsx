// Dev-only: the REAL Combos block fed with the live-read package services.
// Tapping a row shows the route the real handler would push (read-only, nothing is booked).
import { useState } from "react";
import { Text } from "react-native";
import { Screen } from "../ui/kit";
import { CombosSection } from "../ui/CombosSection";
import { LIVE_PACKAGE_SAMPLE } from "../lib/live-packages-sample";

export default function PreviewCombos() {
  const [route, setRoute] = useState("");
  if (!__DEV__) return null;
  return <Screen><CombosSection catalogue={LIVE_PACKAGE_SAMPLE} onBook={(id) => setRoute(`/(tabs)/book/${id}`)} /><Text testID="pushed">{route ? `PUSHED ${route}` : "NOTHING PUSHED"}</Text></Screen>;
}

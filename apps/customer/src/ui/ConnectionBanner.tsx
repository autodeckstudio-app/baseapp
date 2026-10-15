import { Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { useOnline } from "../lib/online";

/** A slim, themed bar shown while the device is offline. It disappears by itself when the connection returns. */
export function ConnectionBanner() {
  const online = useOnline();
  const { name } = useExperienceTheme();
  if (online) return null;
  const day = name === "light";
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" pointerEvents="none" style={{ position: "absolute", top: 8, left: 16, right: 16, maxWidth: 460, alignSelf: "center", zIndex: 70, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: day ? "#16181C" : "#F3F1ED" }}>
      <Text style={{ color: day ? "#F4F2EF" : "#16181C", fontSize: 13, fontWeight: "700", textAlign: "center" }}>You are offline. Some things may not load or save until you reconnect.</Text>
    </View>
  );
}

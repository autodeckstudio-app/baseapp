// Customer tabs: Home, Garage, Bookings, You (spec §5.1). Services,
// membership, notifications and approvals are nested routes, not tabs.
import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useExperienceTheme } from "@autodeck/ui/native";
import { textStyle } from "../../ui/kit";

const GLYPH: Record<string, string> = { index: "◐", garage: "▭", bookings: "◷", profile: "◯" };

export default function TabsLayout() {
  const { colors, glass } = useExperienceTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { ...textStyle("label"), fontSize: 10 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.OS === "ios" ? "transparent" : glass.fallbackFill,
          borderTopColor: colors.borderSubtle,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView tint="dark" intensity={40} style={{ flex: 1 }} />
          ) : (
            <View style={{ flex: 1, backgroundColor: glass.fallbackFill }} />
          ),
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{GLYPH[route.name] ?? "·"}</Text>,
        sceneStyle: { backgroundColor: colors.canvas },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="garage" options={{ title: "Garage" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="profile" options={{ title: "You" }} />
      <Tabs.Screen name="catalogue" options={{ href: null }} />
      <Tabs.Screen name="membership" options={{ href: null }} />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="approvals" options={{ href: null }} />
    </Tabs>
  );
}

// Customer tabs: Home, Services, Bookings, Garage, You. One tab per
// journey: book (Services), track and pay (Bookings), car and papers (Garage).
// Membership, notifications and approvals are nested routes with a back bar.
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { textStyle } from "../../ui/kit";

const GLYPH: Record<string, string> = { index: "◐", catalogue: "✦", bookings: "◷", garage: "▭", profile: "◯" };

export default function TabsLayout() {
  const { colors, glass } = useExperienceTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#C2540A",
        tabBarInactiveTintColor: "#7A7587",
        tabBarLabelStyle: { ...textStyle("label"), fontSize: 10, letterSpacing: 0 },
        // Floating white pill (owner reference): lifted off the bottom edge, rounded.
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          width: "92%",
          marginHorizontal: "auto" as unknown as number,
          bottom: 14,
          height: 64,
          borderRadius: 32,
          borderTopWidth: 0,
          backgroundColor: "rgba(255,255,255,0.92)",
          paddingTop: 6,
          paddingBottom: 8,
          shadowColor: "#7A6FD0",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
          maxWidth: 480,
          alignSelf: "center",
        },
        tabBarBackground: () => <View style={{ flex: 1, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.9)" }} />,
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{GLYPH[route.name] ?? "·"}</Text>,
        sceneStyle: { backgroundColor: colors.canvas },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="catalogue" options={{ title: "Services" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="garage" options={{ title: "Garage" }} />
      <Tabs.Screen name="profile" options={{ title: "You" }} />
      <Tabs.Screen name="membership" options={{ href: null }} />
      <Tabs.Screen name="book" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="approvals" options={{ href: null }} />
    </Tabs>
  );
}

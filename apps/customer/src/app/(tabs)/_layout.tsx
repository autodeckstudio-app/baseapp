// Customer tabs: Home, Services, Bookings, Garage, You. One tab per
// journey: book (Services), track and pay (Bookings), car and papers (Garage).
// Membership, notifications and approvals are nested routes with a back bar.
import { Tabs } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";

const TAB_ICON: Record<string, "home" | "services" | "bookings" | "garage" | "profile"> = { index: "home", catalogue: "services", bookings: "bookings", garage: "garage", profile: "profile" };

export default function TabsLayout() {
  const { colors, glass } = useExperienceTheme();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        // Flat bottom bar, icon only, thin top border, filled icon when active.
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 56,
          borderTopWidth: 1,
          borderTopColor: "rgba(29,27,38,0.12)",
          backgroundColor: "#FFFFFF",
          paddingTop: 0,
          paddingBottom: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { height: 56, alignItems: "center", justifyContent: "center" },
        tabBarIcon: ({ focused }) => <Icon name={TAB_ICON[route.name] ?? "home"} color={focused ? "#1D1B26" : "#6B6877"} size={26} filled={focused} />,
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

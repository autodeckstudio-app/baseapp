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
          left: 14,
          right: 14,
          bottom: 12,
          height: 62,
          borderRadius: 31,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: "rgba(29,27,38,0.08)",
          backgroundColor: "rgba(255,255,255,0.9)",
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 6,
          elevation: 8,
          shadowColor: "#3C285A",
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarItemStyle: { height: 50, marginTop: 5, borderRadius: 25, alignItems: "center", justifyContent: "center" },
        tabBarActiveBackgroundColor: "rgba(240,125,40,0.14)",
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
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="cars" options={{ href: null }} />
    </Tabs>
  );
}

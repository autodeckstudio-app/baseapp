// Customer tabs: Home, Services, Bookings, Garage, You. One tab per
// journey: book (Services), track and pay (Bookings), car and papers (Garage).
// Membership, notifications and approvals are nested routes with a back bar.
import { View } from "react-native";
import { Tabs } from "expo-router";
import { InstallPrompt } from "../../ui/InstallPrompt";
import { PillTabBar, useExperienceTheme } from "@autodeck/ui/native";

const TAB_ICON: Record<string, "home" | "services" | "bookings" | "garage" | "profile"> = { index: "home", catalogue: "services", bookings: "bookings", garage: "garage", profile: "profile" };

export default function TabsLayout() {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      tabBar={(props) => <PillTabBar state={props.state as never} descriptors={props.descriptors as never} navigation={props.navigation as never} icons={TAB_ICON} activeColor="#F59A45" inactiveColor="#C9C9CE" floating dark resetOnPress />}
      screenOptions={() => ({
        headerShown: false,
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
    <InstallPrompt />
    </View>
  );
}

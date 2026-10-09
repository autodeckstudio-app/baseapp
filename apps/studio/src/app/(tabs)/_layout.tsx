import { Tabs } from "expo-router";
import { colors } from "@autodeck/ui";
import { PillTabBar } from "@autodeck/ui/native";

const TAB_ICON: Record<string, "home" | "wrench" | "calendar" | "search" | "profile"> = { index: "home", bays: "wrench", calendar: "calendar", lookup: "search", account: "profile" };

export default function StudioTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <PillTabBar state={props.state as never} descriptors={props.descriptors as never} navigation={props.navigation as never} icons={TAB_ICON} activeColor={colors.accent} inactiveColor={colors.textMuted} floating />}
      screenOptions={() => ({
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarLabel: "Today", headerShown: false }}
      />
      <Tabs.Screen
        name="bays"
        options={{ title: "Bay Board", tabBarLabel: "Bays" }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: "Calendar", tabBarLabel: "Calendar" }}
      />
      <Tabs.Screen
        name="lookup"
        options={{ title: "Lookup", tabBarLabel: "Lookup", headerShown: false }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ href: null, headerShown: false }} // sub-route, hidden from tab bar
      />
      <Tabs.Screen
        name="pickups"
        options={{ title: "Pickup requests", href: null }}
      />
      <Tabs.Screen
        name="memberships"
        options={{ title: "Memberships", href: null }}
      />
      <Tabs.Screen
        name="walkin"
        options={{ title: "New Walk-in", href: null }} // accessed via Bay Board, hidden from tab bar
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarLabel: "Account" }}
      />
    </Tabs>
  );
}

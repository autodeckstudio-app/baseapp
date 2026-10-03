import { Tabs } from "expo-router";
import { colors } from "@autodeck/ui";

export default function StudioTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today's Jobs", tabBarLabel: "Today" }}
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
        options={{ title: "Lookup", tabBarLabel: "Lookup" }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ href: null }} // sub-route, hidden from tab bar
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

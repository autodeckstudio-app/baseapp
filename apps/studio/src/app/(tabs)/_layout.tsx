import { Tabs } from "expo-router";
import { colors } from "@autodeck/ui";
import { Icon } from "@autodeck/ui/native";

const TAB_ICON: Record<string, "home" | "wrench" | "calendar" | "search" | "profile"> = { index: "home", bays: "wrench", calendar: "calendar", lookup: "search", account: "profile" };

export default function StudioTabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }: { focused: boolean }) => <Icon name={TAB_ICON[route.name] ?? "home"} color={focused ? colors.accent : colors.textMuted} size={24} filled={focused} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: colors.border, borderTopWidth: 1, height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
      })}
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
        options={{ title: "Lookup", tabBarLabel: "Lookup", headerShown: false }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ href: null, headerShown: false }} // sub-route, hidden from tab bar
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

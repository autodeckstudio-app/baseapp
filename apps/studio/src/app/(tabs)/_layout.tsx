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
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: "rgba(255,255,255,0.92)", borderTopWidth: 0, borderWidth: 1, borderColor: "rgba(29,27,38,0.08)", height: 64, marginHorizontal: 14, marginBottom: 12, borderRadius: 32, paddingHorizontal: 6, paddingTop: 0, paddingBottom: 0, elevation: 8, shadowColor: "#3C285A", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
        tabBarItemStyle: { height: 52, marginTop: 6, borderRadius: 26 },
        tabBarActiveBackgroundColor: "rgba(240,125,40,0.14)",
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

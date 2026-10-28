import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle, floatScene } from "@autodeck/ui/theme";
import { Tabs } from "expo-router";
import { colors, isNightPalette, phoneFont } from "@autodeck/ui";
import { PillTabBar } from "@autodeck/ui/native";
import { useWindowDimensions } from "react-native";
import { SideRail } from "../../components/SideRail";

const TAB_ICON: Record<string, "home" | "wrench" | "calendar" | "search" | "profile" | "pin"> = { index: "home", bays: "wrench", pickups: "pin", calendar: "calendar", lookup: "search" };

const TAB_LABEL: Record<string, string> = { index: "Today", bays: "Bays", pickups: "Pickups", calendar: "Calendar", lookup: "Lookup" };

export default function StudioTabsLayout() {
  const { width } = useWindowDimensions();
  const wide = NightPlatform.OS === "web" && width >= 900;
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => wide ? <SideRail state={props.state as never} navigation={props.navigation as never} /> : <PillTabBar state={props.state as never} descriptors={props.descriptors as never} navigation={props.navigation as never} icons={TAB_ICON} labels={TAB_LABEL} activeColor={colors.accent} inactiveColor={colors.textMuted} dark={isNightPalette} floating />}
      screenOptions={() => ({
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: "500", fontSize: phoneFont(22, 18), letterSpacing: -0.4 },
        sceneStyle: { backgroundColor: colors.background, ...(NightPlatform.OS === "web" ? floatScene(nightMaterial) : {}), ...(wide ? { paddingLeft: 252 } : {}) },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarLabel: "Today", headerShown: false }}
      />
      <Tabs.Screen
        name="bays"
        options={{ title: "Bay Board", tabBarLabel: "Bays", headerShown: false }}
      />
      <Tabs.Screen
        name="pickups"
        options={{ title: "Pickups", tabBarLabel: "Pickups", headerShown: false }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: "Calendar", tabBarLabel: "Calendar", headerShown: false }}
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
        name="memberships"
        options={{ title: "Memberships", href: null, headerShown: false }}
      />
      <Tabs.Screen
        name="walkin"
        options={{ title: "New Walk-in", href: null }} // accessed via Bay Board, hidden from tab bar
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", href: null, headerShown: false }} // reached from Today (My day) and the side rail
      />
    </Tabs>
  );
}

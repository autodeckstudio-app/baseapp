import { Pressable, View, Text, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Icon } from "./Icon.js";
import type { IconName } from "../theme/icons.js";
import { emitTabPressed } from "./tabBus.js";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { href?: unknown; title?: string; tabBarAccessibilityLabel?: string } }>;
  navigation: { navigate: (name: string, params?: object) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  icons: Record<string, IconName>;
  activeColor: string;
  inactiveColor: string;
  badges?: Record<string, boolean>;
  /** Dark glass (customer app): translucent black, Instagram-style plain icons. */
  dark?: boolean;
  /** Every press returns the tab to its first screen and the top. */
  resetOnPress?: boolean;
  /** Optional visible name under each icon, keyed by route name. */
  labels?: Record<string, string>;
  floating?: boolean; // true = overlay the screen (absolute), false = sits in the layout
};

/** Floating pill bar: icons only, each centred in an equal slot, active tab in a rounded highlight. */
export function PillTabBar({ state, descriptors, navigation, icons, activeColor, inactiveColor, badges, labels, floating = false, dark = false, resetOnPress = false }: Props) {
  const visible = state.routes.filter((r) => descriptors[r.key]?.options.href !== null && icons[r.name]);
  return (
    <View
      style={{
        position: floating ? "absolute" : "relative",
        left: floating ? 14 : undefined,
        right: floating ? 14 : undefined,
        ...(Platform.OS === "web" ? ({ maxWidth: 480, marginLeft: "auto", marginRight: "auto" } as object) : {}),
        bottom: floating ? ((Platform.OS === "web" ? "calc(12px + env(safe-area-inset-bottom))" : 12) as unknown as number) : undefined,
        marginHorizontal: floating ? 0 : 14,
        marginBottom: floating ? 0 : ((Platform.OS === "web" ? "calc(12px + env(safe-area-inset-bottom))" : 12) as unknown as number),
        height: labels ? 68 : 62,
        borderRadius: labels ? 34 : 31,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: dark ? "rgba(12,12,14,0.55)" : Platform.OS === "web" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.35)",
        borderWidth: 1,
        borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.7)",
        paddingHorizontal: 6,
        shadowColor: dark ? "#000" : "#3C285A",
        shadowOpacity: dark ? 0.5 : 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(145deg, rgba(255,255,255,.10), rgba(255,255,255,.03))", boxShadow: "0 24px 60px -18px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.22)", backdropFilter: "saturate(170%) blur(26px)", WebkitBackdropFilter: "saturate(180%) blur(28px)" } as object) : {}),
      }}
    >
      {Platform.OS !== "web" ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 31, overflow: "hidden" }}>
          <BlurView intensity={60} tint={dark ? "dark" : "light"} style={{ flex: 1 }} />
        </View>
      ) : null}
      {visible.map((route) => {
        const focused = state.routes[state.index]?.key === route.key;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (ev.defaultPrevented) return;
              if (resetOnPress) {
                navigation.navigate(route.name, { screen: "index", params: { cat: undefined, brand: undefined, need: undefined } });
                emitTabPressed(route.name);
              } else if (!focused) navigation.navigate(route.name);
            }}
            style={({ pressed }) => ({ flex: 1, height: labels ? 68 : 62, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ width: labels ? 70 : 58, height: labels ? 54 : 46, borderRadius: labels ? 27 : 23, backgroundColor: focused && !dark ? "rgba(240,125,40,0.16)" : "transparent", ...(Platform.OS === "web" ? ({ display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 180ms ease, transform 180ms ease", transform: focused ? "scale(1)" : "scale(0.94)" } as object) : { alignItems: "center", justifyContent: "center" }) }}>
              <Icon name={icons[route.name] ?? "home"} color={focused ? activeColor : inactiveColor} size={24} filled={focused} />
              {labels?.[route.name] ? <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11, fontWeight: focused ? "700" : "500", color: focused ? activeColor : inactiveColor }}>{labels[route.name]}</Text> : null}
              {badges?.[route.name] ? <View style={{ position: "absolute", top: 8, right: 14, width: 9, height: 9, borderRadius: 5, backgroundColor: "#E5484D", borderWidth: 2, borderColor: dark ? "#0B0B0D" : "#fff" }} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

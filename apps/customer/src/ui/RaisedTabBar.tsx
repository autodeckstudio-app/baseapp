// Customer tab bar, Instagram style: translucent glass, plain outline icons with no labels,
// the active icon on a soft orange tint. It shrinks while the page scrolls down and returns on scroll up.
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, View } from "react-native";
import { NavIcon, type NavIconName } from "./NavIcon";
import { AdMonogram } from "./AdMonogram";
import { emitTabPressed, useExperienceTheme } from "@autodeck/ui/native";
import { onNavCompact } from "../lib/nav-scroll";
import { reducedMotion } from "./Drift";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { href?: unknown; title?: string } }>;
  navigation: { navigate: (name: string, params?: object) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  icons: Record<string, NavIconName>;
};

export function RaisedTabBar({ state, descriptors, navigation, icons }: Props) {
  const { name, colors } = useExperienceTheme();
  const light = name === "light";
  const visible = state.routes.filter((r2) => descriptors[r2.key]?.options.href !== null && icons[r2.name]);
  const activeKey = state.routes[state.index]?.key;
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => onNavCompact((c) => { Animated.timing(t, { toValue: c ? 1 : 0, duration: reducedMotion() ? 0 : 220, useNativeDriver: Platform.OS !== "web" }).start(); }), [t]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] });
  const lift = t.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });
  const glass = light
    ? { backgroundColor: "rgba(251,248,243,0.62)", borderColor: "rgba(60,48,36,0.10)" }
    : { backgroundColor: "rgba(24,24,28,0.50)", borderColor: "rgba(255,255,255,0.10)" };
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: (Platform.OS === "web" ? "calc(8px + env(safe-area-inset-bottom))" : 8) as unknown as number, alignItems: "center", paddingHorizontal: 12 }}
    >
      <Animated.View style={{ width: "100%", maxWidth: 360, transform: [{ translateY: lift }, { scale }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", width: "100%", paddingHorizontal: 6, paddingVertical: 6, borderRadius: 24, borderWidth: 1, ...glass, ...(Platform.OS === "web" ? ({ backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)" } as object) : null) }}>
        {visible.map((route) => {
          const focused = activeKey === route.key;
          const label = descriptors[route.key]?.options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (ev.defaultPrevented) return;
                navigation.navigate(route.name, { screen: "index", params: { cat: undefined, brand: undefined, need: undefined } });
                emitTabPressed(route.name);
              }}
              style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 2, opacity: pressed ? 0.7 : 1 })}
            >
              {route.name === "index" ? (
                <View style={{ width: 56, height: 56, marginTop: -22, marginBottom: -4, borderRadius: 9999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: focused ? "rgba(236,134,56,0.85)" : "rgba(236,134,56,0.35)", backgroundColor: light ? "rgba(251,248,243,0.96)" : "rgba(27,27,31,0.96)", ...(Platform.OS === "web" ? ({ boxShadow: "0 6px 18px rgba(0,0,0,0.28), 0 0 14px rgba(236,134,56,0.22)" } as object) : {}) }}>
                  <AdMonogram theme={light ? "light" : "dark"} width={32} />
                </View>
              ) : (
              <View style={{ width: 52, height: 36, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: focused ? "rgba(236,134,56,0.26)" : "transparent" }}>
                <NavIcon name={icons[route.name] ?? "home"} color={focused ? colors.textPrimary : colors.textSecondary} size={26} filled={focused} cut={light ? "#FBF8F3" : "#18181C"} />
              </View>
              )}
            </Pressable>
          );
        })}
      </View>
      </Animated.View>
    </View>
  );
}

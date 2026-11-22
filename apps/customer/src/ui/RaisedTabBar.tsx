import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingObject } from "./FloatingObject";
// Customer tab bar: short labels, official AD centre mark, and theme-aware raised material.
// It shrinks while the page scrolls down and returns on scroll up.
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, View } from "react-native";
import { NavIcon, type NavIconName } from "./NavIcon";
import {raised} from "../lib/raised";
import { AdMonogram } from "./AdMonogram";
import { emitTabPressed, useExperienceTheme } from "@autodeck/ui/native";
import { onNavCompact } from "../lib/nav-scroll";
import { useReduceMotion } from "../lib/reduce-motion";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { href?: unknown; title?: string } }>;
  navigation: { navigate: (name: string, params?: object) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  icons: Record<string, NavIconName>;
};

export function RaisedTabBar({ state, descriptors, navigation, icons }: Props) {
  const { name } = useExperienceTheme();
  const insets = useSafeAreaInsets();
  const light = name === "light";
  const visible = state.routes.filter((r2) => descriptors[r2.key]?.options.href !== null && icons[r2.name]);
  const activeKey = state.routes[state.index]?.key;
  const t = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  const compact = useRef(false);
  useEffect(() => {
    t.stopAnimation();
    if (reduce) t.setValue(compact.current ? 1 : 0);
    const unsubscribe = onNavCompact((c) => {
      compact.current = c;
      t.stopAnimation();
      if (reduce) { t.setValue(c ? 1 : 0); return; }
      Animated.timing(t, { toValue: c ? 1 : 0, duration: 220, useNativeDriver: Platform.OS !== "web" }).start();
    });
    return () => { unsubscribe(); t.stopAnimation(); };
  }, [t, reduce]);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1] });
  const lift = t.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const surfaces=raised(name);
  // Dark island bar in both themes (user's 19 Nov nav choice): monogram + line icons on ink.
  const island = { backgroundColor: "#16181C", borderColor: light ? "rgba(20,22,26,0.10)" : "rgba(255,255,255,0.10)" };
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: (Platform.OS === "web" ? "calc(8px + env(safe-area-inset-bottom))" : 8 + insets.bottom) as unknown as number, alignItems: "center", paddingHorizontal: 12 }}
    >
      <Animated.View style={{ width: "100%", maxWidth: 360, transform: [{ translateY: lift }, { scale }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", width: "100%", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 22, borderWidth: 1, ...surfaces.card,...island, ...(Platform.OS === "web" ? ({ backdropFilter: "blur(16px) saturate(140%)", WebkitBackdropFilter: "blur(16px) saturate(140%)" } as object) : null) }}>
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
              style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", justifyContent: "center", paddingVertical: 2, opacity: pressed ? 0.7 : 1 })}
            >
              {route.name === "index" ? (
                // AD monogram with no circle; a subtle orange glow appears only while Home is selected.
                <View style={[{ width: 52, height: 32, alignItems: "center", justifyContent: "center" }, focused && Platform.OS === "web" ? ({ filter: "drop-shadow(0 0 10px rgba(236,134,56,0.6))" } as object) : null, focused && Platform.OS !== "web" ? { shadowColor: "#EC8638", shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null]}>
                  <AdMonogram theme="dark" width={30} />
                </View>
              ) : (
              <View style={{ width: 52, height: 32, borderRadius: 9999, alignItems: "center", justifyContent: "center" }}>
                {route.name === "profile" ? <NavIcon name="profile" color={focused ? "#FFFFFF" : "rgba(255,255,255,0.55)"} size={22} filled={focused} cut="#16181C" /> : <View style={{opacity:focused?1:.72}}><FloatingObject name={route.name === "bookings" ? "bookings" : route.name === "garage" ? "garage" : "services"} size={26} /></View>}
              </View>
              )}
              {focused && route.name !== "index" ? <View style={{position:"absolute",bottom:1,width:3,height:3,borderRadius:2,backgroundColor:"#EC8638"}} /> : null}
            </Pressable>
          );
        })}
      </View>
      </Animated.View>
    </View>
  );
}

import { Pressable, View, Platform } from "react-native";
import { Icon } from "./Icon.js";
import type { IconName } from "../theme/icons.js";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { href?: unknown; title?: string; tabBarAccessibilityLabel?: string } }>;
  navigation: { navigate: (name: string) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  icons: Record<string, IconName>;
  activeColor: string;
  inactiveColor: string;
  floating?: boolean; // true = overlay the screen (absolute), false = sits in the layout
};

/** Floating pill bar: icons only, each centred in an equal slot, active tab in a rounded highlight. */
export function PillTabBar({ state, descriptors, navigation, icons, activeColor, inactiveColor, floating = false }: Props) {
  const visible = state.routes.filter((r) => descriptors[r.key]?.options.href !== null && icons[r.name]);
  return (
    <View
      style={{
        position: floating ? "absolute" : "relative",
        left: floating ? 14 : undefined,
        right: floating ? 14 : undefined,
        bottom: floating ? 12 : undefined,
        marginHorizontal: floating ? 0 : 14,
        marginBottom: floating ? 0 : 12,
        height: 62,
        borderRadius: 31,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.92)",
        borderWidth: 1,
        borderColor: "rgba(29,27,38,0.08)",
        paddingHorizontal: 6,
        shadowColor: "#3C285A",
        shadowOpacity: 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
        ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)" } as object) : {}),
      }}
    >
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
              if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, height: 62, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ width: 58, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: focused ? "rgba(240,125,40,0.16)" : "transparent" }}>
              <Icon name={icons[route.name]!} color={focused ? activeColor : inactiveColor} size={25} filled={focused} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

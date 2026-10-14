// Customer tab bar in the reference style: one soft raised bar across the
// bottom, icons with small labels, the active tab a pressed well with an orange icon.
import { Platform, Pressable, Text, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { emitTabPressed, useExperienceTheme } from "@autodeck/ui/native";
import { raised } from "../lib/raised";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { href?: unknown; title?: string } }>;
  navigation: { navigate: (name: string, params?: object) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  icons: Record<string, IconName>;
};

export function RaisedTabBar({ state, descriptors, navigation, icons }: Props) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const visible = state.routes.filter((r2) => descriptors[r2.key]?.options.href !== null && icons[r2.name]);
  const activeKey = state.routes[state.index]?.key;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: (Platform.OS === "web" ? "calc(8px + env(safe-area-inset-bottom))" : 8) as unknown as number, alignItems: "center", paddingHorizontal: 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-around", width: "100%", maxWidth: 360, paddingHorizontal: 6, paddingVertical: 4, ...r.sheet, borderRadius: 24, ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object) : {}) }}>
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
              style={({ pressed }) => ({ flex: 1, minWidth: 0, alignItems: "center", gap: 1, paddingVertical: 3, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 40, height: 28, borderRadius: 12, alignItems: "center", justifyContent: "center", ...(focused ? r.well : null) }}>
                <Icon name={icons[route.name] ?? "home"} color={focused ? "#EC8638" : colors.inactive} size={20} filled={focused} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: focused ? "700" : "500", color: focused ? colors.textPrimary : colors.inactive }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

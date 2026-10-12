// Customer tab bar in the reference style: dark floating bar, each tab a round
// button, the active one a raised orange disc.
import { colors as palette } from "@autodeck/ui/tokens";
import { Platform, Pressable, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { emitTabPressed } from "@autodeck/ui/native";
import { glassChrome } from "../lib/glass";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { href?: unknown; title?: string } }>;
  navigation: { navigate: (name: string, params?: object) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  icons: Record<string, IconName>;
};

export function RaisedTabBar({ state, descriptors, navigation, icons }: Props) {
  const visible = state.routes.filter((r) => descriptors[r.key]?.options.href !== null && icons[r.name]);
  const activeKey = state.routes[state.index]?.key;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: (Platform.OS === "web" ? "calc(10px + env(safe-area-inset-bottom))" : 10) as unknown as number,
        alignItems: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          width: "100%",
          maxWidth: 360,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 24,
          ...glassChrome,
          ...(Platform.OS === "web" ? {} : { elevation: 10 }),
        }}
      >
        {visible.map((route) => {
          const focused = activeKey === route.key;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (ev.defaultPrevented) return;
                navigation.navigate(route.name, { screen: "index", params: { cat: undefined, brand: undefined, need: undefined } });
                emitTabPressed(route.name);
              }}
              style={({ pressed }) => ({
                width: 52,
                height: 44,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? "#E8742A" : "transparent",
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Icon name={icons[route.name] ?? "home"} color={focused ? "#FFFFFF" : palette.textSecondary} size={22} filled={focused} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

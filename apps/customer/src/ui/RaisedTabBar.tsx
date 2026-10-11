// Customer tab bar in the reference style: dark floating bar, each tab a round
// button, the active one a raised orange disc.
import { Platform, Pressable, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { emitTabPressed } from "@autodeck/ui/native";

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
          borderRadius: 40,
          backgroundColor: "rgba(10,10,12,0.92)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
          ...(Platform.OS === "web" ? ({ boxShadow: "0 18px 40px -10px rgba(0,0,0,.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as object) : { elevation: 10 }),
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
                width: focused ? 58 : 48,
                height: focused ? 58 : 48,
                marginTop: focused ? -14 : 0,
                borderRadius: 30,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? "#EC8638" : "#3A3A3E",
                opacity: pressed ? 0.8 : 1,
                ...(Platform.OS === "web" && focused ? ({ boxShadow: "0 10px 24px rgba(236,134,56,.45)" } as object) : {}),
              })}
            >
              <Icon name={icons[route.name] ?? "home"} color={focused ? "#1A1410" : "#D9D7D3"} size={focused ? 26 : 22} filled={focused} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

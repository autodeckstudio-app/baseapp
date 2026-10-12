import { Pressable, View, Text } from "react-native";
import { colors, isNightPalette } from "@autodeck/ui";
import { Icon } from "@autodeck/ui/native";

type Route = { key: string; name: string };
type Props = {
  state: { index: number; routes: Route[] };
  navigation: { navigate: (name: string) => void };
};

// Desktop and tablet navigation: the same idea as the admin sidebar. Daily pages big,
// the rest quieter, one orange active pill. Phones keep the bottom bar.
const MAIN: { name: string; label: string; icon: "home" | "wrench" | "calendar" | "search" | "profile" }[] = [
  { name: "index", label: "Today", icon: "home" },
  { name: "bays", label: "Bays", icon: "wrench" },
  { name: "calendar", label: "Calendar", icon: "calendar" },
  { name: "lookup", label: "Lookup", icon: "search" },
];
const MORE: { name: string; label: string }[] = [
  { name: "pickups", label: "Pickups" },
  { name: "memberships", label: "Memberships" },
  { name: "account", label: "Account" },
];

export function SideRail({ state, navigation }: Props) {
  const active = state.routes[state.index]?.name;
  const item = (name: string, label: string, big: boolean, icon?: (typeof MAIN)[number]["icon"]) => {
    const on = active === name;
    return (
      <Pressable
        key={name}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => navigation.navigate(name)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: big ? 48 : 38, paddingHorizontal: 14, borderRadius: 14, ...(on ? ({ backgroundImage: "linear-gradient(180deg, #F08A3C, #D9701F)", boxShadow: "0 10px 22px -10px rgba(217,112,31,.7)" } as object) : {}) }}
      >
        {icon ? <Icon name={icon} size={20} color={on ? "#FFFFFF" : colors.textPrimary} /> : null}
        <Text style={{ fontSize: big ? 16 : 13, fontWeight: big ? "600" : "500", color: on ? "#FFFFFF" : colors.textPrimary, opacity: big || on ? 1 : 0.82 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View
      style={{ position: "absolute", top: 14, left: 14, bottom: 14, width: 224, borderRadius: 20, paddingVertical: 20, paddingHorizontal: 12, justifyContent: "space-between", zIndex: 20, ...({ backgroundColor: isNightPalette ? "rgba(34,34,32,.46)" : "rgba(255,255,255,.40)", backgroundImage: isNightPalette ? "linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.04))" : "linear-gradient(160deg, rgba(255,255,255,.70), rgba(255,255,255,.18))", boxShadow: isNightPalette ? "0 24px 54px -22px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.22)" : "0 22px 48px -22px rgba(110,70,30,.34), inset 0 1px 0 rgba(255,255,255,.9)", backdropFilter: "saturate(170%) blur(28px)", WebkitBackdropFilter: "saturate(170%) blur(28px)" } as object) }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: 2, color: colors.textPrimary, paddingHorizontal: 14, marginBottom: 18 }}>AUTODECK</Text>
        {MAIN.map((m) => item(m.name, m.label, true, m.icon))}
      </View>
      <View style={{ gap: 2 }}>{MORE.map((m) => item(m.name, m.label, false))}</View>
    </View>
  );
}

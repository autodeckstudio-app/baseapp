import { Pressable, View, Text } from "react-native";
import { colors } from "@autodeck/ui";
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
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: big ? 48 : 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? "rgba(236,134,56,.6)" : "transparent", backgroundColor: on ? "rgba(236,134,56,.20)" : "transparent" }}
      >
        {icon ? <Icon name={icon} size={20} color={on ? colors.accent : colors.textMuted} /> : null}
        <Text style={{ fontSize: big ? 16 : 13, fontWeight: big ? "600" : "500", color: on ? colors.accent : colors.textPrimary, opacity: big || on ? 1 : 0.62 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View
      style={{ position: "absolute", top: 14, left: 14, bottom: 14, width: 224, borderRadius: 28, paddingVertical: 20, paddingHorizontal: 12, justifyContent: "space-between", backgroundColor: "rgba(34,34,32,.72)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)", zIndex: 20, ...({ backdropFilter: "saturate(160%) blur(24px)", WebkitBackdropFilter: "saturate(160%) blur(24px)" } as object) }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: 2, color: colors.textPrimary, paddingHorizontal: 14, marginBottom: 18 }}>AUTODECK</Text>
        {MAIN.map((m) => item(m.name, m.label, true, m.icon))}
      </View>
      <View style={{ gap: 2 }}>{MORE.map((m) => item(m.name, m.label, false))}</View>
    </View>
  );
}

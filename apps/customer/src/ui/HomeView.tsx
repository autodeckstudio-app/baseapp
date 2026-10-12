// Customer Home in the reference layout: greeting + search, category chips,
// "Your garage" circles, photo cards with a heart and price, reminders.
import { useState, type ReactNode } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, type ImageSourcePropType } from "react-native";
import { Icon } from "@autodeck/ui/native";
import { serviceImagery, vehicleImagery } from "../lib/imagery";

export type HomeCar = { id: string; title: string; plate: string; photo?: string | null; category?: string | null };
export type HomeService = { id: string; category: string; name: string; price: string; brand?: string | null };
export type HomeReminder = { title: string; detail: string; chip: string; danger: boolean };
export type HomeLive = { kicker: string; title: string; detail: string; onPress: () => void };
export type HomeViewProps = {
  greeting: string;
  unread: number;
  cars: HomeCar[];
  services: HomeService[];
  reminders: HomeReminder[];
  live: HomeLive | null;
  banner?: ReactNode;
  initialChip?: string | null;
  stories?: ReactNode;
  onSearch: () => void;
  onBell: () => void;
  onAllServices: () => void;
  onCategory: (category: string | null) => void;
  onService: (s: HomeService) => void;
  onCar: (c: HomeCar) => void;
  onAddCar: () => void;
  onReminders: () => void;
};

import { glassSurface, glassInner, glassOrange } from "../lib/glass";
import { MENU_CHIPS, MENU_GROUPS } from "@autodeck/core";
import { colors as palette } from "@autodeck/ui/tokens";
const ACCENT = palette.accent;
// Popular-services groups. Ceramic lives under Coatings; tint is the one
// modification category today; inspection and other care sit under Garage.
const GROUPS: Array<{ key: string | null; label: string; cats: string[] }> = [
  { key: null, label: "All", cats: [] },
  ...MENU_CHIPS.map((k) => { const g = MENU_GROUPS.find((x) => x.key === k)!; return { key: k as string, label: g.key === "mods" ? "Modifications" : g.label, cats: g.categories as string[] }; }),
];
const TITLES: Record<string, string> = { washing: "Wash and care", ceramic: "Ceramic coating", coating: "Coating", ppf: "Paint protection film", tinting: "Window tint", inspection: "Inspection", other: "Care", garage: "Garage", modifications: "Modifications", pickup: "Pickup and drop" };

function Heading({ title, action, onAction }: { title: string; action?: string | undefined; onAction?: (() => void) | undefined }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: palette.textPrimary, fontSize: 19, fontWeight: "700" }}>{title}</Text>
      {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={{ color: palette.textSecondary, fontSize: 14, fontWeight: "600" }}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function PhotoCard({ media, title, pill, onPress, hearted = true }: { media: ReactNode; title: string; pill?: string | undefined; onPress: () => void; hearted?: boolean }) {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minWidth: 0, borderRadius: 20, overflow: "hidden", ...glassSurface, aspectRatio: 0.82 }}>
      <View style={{ position: "absolute", width: "100%", height: "100%" }}>{media}</View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.25)" }) }} />
      <View style={{ position: "absolute", left: 12, right: hearted ? 44 : 12, top: 12 }}>
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{title}</Text>
      </View>
      {hearted ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={() => setLiked(!liked)} hitSlop={8} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: liked ? "#E5484D" : "#9A9AA0", fontSize: 16, marginTop: -1 }}>{liked ? "\u2665" : "\u2661"}</Text>
        </Pressable>
      ) : null}
      {pill ? <View style={{ position: "absolute", right: 10, bottom: 10, borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>{pill}</Text></View> : null}
    </Pressable>
  );
}

function ServiceCard({ s, onPress }: { s: HomeService; onPress: () => void }) {
  const img = (serviceImagery as Record<string, ImageSourcePropType>)[s.category] ?? serviceImagery.other;
  return <PhotoCard title={s.name} pill={s.price === "Quote on request" ? "Quote" : s.price} onPress={onPress} media={<Image source={img} resizeMode="cover" style={{ width: "100%", height: "100%" }} />} />;
}

export function GroupChips({ value, onChange }: { value: string | null; onChange: (k: string | null) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 22, paddingRight: 8 }}>
      {GROUPS.map((c) => {
        const on = value === c.key;
        return (
          <Pressable key={c.label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} style={{ paddingVertical: 6 }}>
            <Text style={{ color: on ? ACCENT : "#B4B2AE", fontSize: 15, fontWeight: on ? "700" : "500" }}>{c.label}</Text>
            {on ? <View style={{ height: 2, borderRadius: 1, backgroundColor: ACCENT, marginTop: 4 }} /> : <View style={{ height: 2, marginTop: 4 }} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
export const groupCategories = (key: string | null): string[] => GROUPS.find((g) => g.key === key)?.cats ?? [];

export function HomeView(p: HomeViewProps) {
  const [chip, setChip] = useState<string | null>(p.initialChip ?? null);
  const cats = groupCategories(chip);
  const shown = p.services.filter((s) => !chip || cats.includes(s.category));
  const byBrand = chip === "coatings" || chip === "ppf";
  // All shows the top 4 only; a chip shows everything in its group.
  const visible = chip === null ? shown.slice(0, 4) : shown;
  const chunk = (xs: HomeService[]) => { const r: HomeService[][] = []; for (let i = 0; i < xs.length; i += 2) r.push(xs.slice(i, i + 2)); return r; };
  const brandGroups: Array<[string, HomeService[]]> = [];
  if (byBrand) for (const sv of visible) { const k = sv.brand?.trim() || "Other"; const g = brandGroups.find(([n]) => n === k); if (g) g[1].push(sv); else brandGroups.push([k, [sv]]); }
  const renderRows = (xs: HomeService[]) => chunk(xs).map((r, i) => (
    <View key={i} style={{ flexDirection: "row", gap: 12 }}>
      {r.map((s) => <ServiceCard key={s.id} s={s} onPress={() => p.onService(s)} />)}
      {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
    </View>
  ));
  return (
    <View style={{ gap: 22, paddingBottom: 110 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={{ color: palette.textMuted, fontSize: 13 }}>AutoDeck</Text>
          <Text style={{ color: palette.textPrimary, fontSize: 24, fontWeight: "700" }}>{p.greeting}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={p.unread > 0 ? `Notifications, ${p.unread} unread` : "Notifications"} onPress={p.onBell} style={{ width: 42, height: 42, borderRadius: 14, ...glassSurface, alignItems: "center", justifyContent: "center" }}>
          <Icon name="bell" color={palette.textSecondary} size={21} />
          {p.unread > 0 ? <View style={{ position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT }} /> : null}
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Pressable accessibilityRole="search" onPress={p.onSearch} style={{ flex: 1, height: 48, borderRadius: 14, ...glassSurface, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
          <Icon name="search" color={palette.textMuted} size={20} />
          <Text style={{ color: palette.textMuted, fontSize: 15 }}>Search services</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="All services" onPress={p.onAllServices} style={{ width: 48, height: 48, borderRadius: 14, ...glassOrange, alignItems: "center", justifyContent: "center" }}>
          <Icon name="services" color="#FFFFFF" size={22} />
        </Pressable>
      </View>

      {p.stories}
      {p.banner}

      {p.live ? (
        <Pressable accessibilityRole="button" onPress={p.live.onPress} style={{ borderRadius: 20, ...glassSurface, padding: 16, gap: 4 }}>
          <Text style={{ color: ACCENT, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{p.live.kicker}</Text>
          <Text style={{ color: palette.textPrimary, fontSize: 17, fontWeight: "700" }}>{p.live.title}</Text>
          <Text style={{ color: palette.textSecondary, fontSize: 14 }}>{p.live.detail}</Text>
        </Pressable>
      ) : null}

      <View style={{ gap: 12 }}>
        <Heading title="Your garage" action={p.cars.length ? "See all" : undefined} onAction={() => p.cars[0] && p.onCar(p.cars[0])} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingRight: 8 }}>
          {p.cars.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.title} onPress={() => p.onCar(c)} style={{ alignItems: "center", gap: 6, width: 72 }}>
              <View style={{ width: 66, height: 66, borderRadius: 33, overflow: "hidden", borderWidth: 2, borderColor: palette.borderStrong, ...glassInner }}>
                <Image source={c.photo ? { uri: c.photo } : ((vehicleImagery as Record<string, ImageSourcePropType>)[c.category ?? "sedan"] ?? vehicleImagery.sedan)} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
              </View>
              <Text numberOfLines={1} style={{ color: palette.textSecondary, fontSize: 12 }}>{c.title}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add a car" onPress={p.onAddCar} style={{ alignItems: "center", gap: 6, width: 72 }}>
            <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, borderStyle: "dashed", borderColor: palette.textMuted, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: palette.textSecondary, fontSize: 28, marginTop: -2 }}>+</Text>
            </View>
            <Text style={{ color: palette.textMuted, fontSize: 12 }}>Add car</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
        <Heading title="Popular services" action="View all" onAction={p.onAllServices} />
        <GroupChips value={chip} onChange={(k) => { setChip(k); p.onCategory(k); }} />
        {byBrand
          ? brandGroups.map(([brand, xs]) => (
              <View key={brand} style={{ gap: 10 }}>
                <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{brand}</Text>
                {renderRows(xs)}
              </View>
            ))
          : renderRows(visible)}
        {visible.length === 0 ? <Text style={{ color: palette.textMuted, fontSize: 14 }}>Nothing here yet.</Text> : null}
      </View>

      {p.reminders.length ? (
        <View style={{ gap: 12 }}>
          <Heading title="Reminders" />
          {p.reminders.map((r) => (
            <Pressable key={r.title} accessibilityRole="button" onPress={p.onReminders} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, ...glassSurface, padding: 14 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: palette.textPrimary, fontSize: 15, fontWeight: "600" }}>{r.title}</Text>
                <Text style={{ color: palette.textSecondary, fontSize: 13 }}>{r.detail}</Text>
              </View>
              <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: r.danger ? "rgba(229,72,77,.18)" : "rgba(236,134,56,.18)" }}>
                <Text style={{ color: r.danger ? palette.error : "#F3B27A", fontSize: 12, fontWeight: "700" }}>{r.chip}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

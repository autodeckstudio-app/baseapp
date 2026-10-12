// Customer Home in the reference layout: round menu + car and status + bell and
// avatar, a car hero, visit and health tiles, four round actions, studio and
// membership tiles, stories, brand widgets, popular services and reminders.
import { useState, type ReactNode } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, type ImageSourcePropType } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { serviceImagery, vehicleImagery, sceneImagery } from "../lib/imagery";
import { raised } from "../lib/raised";

export type HomeCar = { id: string; title: string; plate: string; photo?: string | null; category?: string | null };
export type HomeService = { id: string; category: string; name: string; price: string; brand?: string | null };
export type HomeReminder = { title: string; detail: string; chip: string; danger: boolean };
export type HomeLive = { kicker: string; title: string; detail: string; onPress: () => void };
export type HomeViewProps = {
  greeting: string;
  initial: string;
  unread: number;
  cars: HomeCar[];
  services: HomeService[];
  reminders: HomeReminder[];
  live: HomeLive | null;
  /** 0 to 100 when a visit is under way, else null. */
  progress: number | null;
  stage: string;
  health: { label: string; ok: boolean };
  membership: { title: string; detail: string } | null;
  studio: { address: string; hours: string };
  banner?: ReactNode;
  initialChip?: string | null;
  stories?: ReactNode;
  onMenu: () => void;
  onAvatar: () => void;
  onSearch: () => void;
  onBell: () => void;
  onAllServices: () => void;
  onCategory: (category: string | null) => void;
  onService: (s: HomeService) => void;
  onCar: (c: HomeCar) => void;
  onCareMap: () => void;
  onAddCar: () => void;
  onReminders: () => void;
  onBook: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
  onStudio: () => void;
  onMembership: () => void;
  onVisits: () => void;
  onShare: () => void;
};

import { glassSurface, glassInner, glassOrange } from "../lib/glass";
import { MENU_CHIPS, MENU_GROUPS } from "@autodeck/core";
const ACCENT = "#EC8638";
void ACCENT;
// Popular-services groups. Ceramic lives under Coatings; tint is the one
// modification category today; inspection and other care sit under Garage.
const GROUPS: Array<{ key: string | null; label: string; cats: string[] }> = [
  { key: null, label: "All", cats: [] },
  ...MENU_CHIPS.map((k) => { const g = MENU_GROUPS.find((x) => x.key === k)!; return { key: k as string, label: g.key === "mods" ? "Modifications" : g.label, cats: g.categories as string[] }; }),
];
const TITLES: Record<string, string> = { washing: "Wash and care", ceramic: "Ceramic coating", coating: "Coating", ppf: "Paint protection film", tinting: "Window tint", inspection: "Inspection", other: "Care", garage: "Garage", modifications: "Modifications", pickup: "Pickup and drop" };

function Heading({ title, action, onAction }: { title: string; action?: string | undefined; onAction?: (() => void) | undefined }) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700" }}>{title}</Text>
      {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={{ color: colors.accentStrong, fontSize: 14, fontWeight: "600" }}>{action}</Text></Pressable> : null}
    </View>
  );
}

function Round({ icon, label, onPress, on, badge }: { icon: IconName; label: string; onPress: () => void; on?: boolean; badge?: boolean }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", gap: 8, opacity: pressed ? 0.75 : 1, flex: 1 })}>
      <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center", ...(on ? r.roundOn : r.round) }}>
        <Icon name={icon} color={on ? "#1A1410" : colors.textPrimary} size={24} />
        {badge ? <View style={{ position: "absolute", top: 14, right: 16, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function Tile({ title, children, onPress, style }: { title: string; children: ReactNode; onPress?: () => void; style?: object }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ minWidth: 0, borderRadius: 24, padding: 16, gap: 8, opacity: pressed ? 0.85 : 1, ...r.card, ...style })}>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
      {children}
    </Pressable>
  );
}

function Brand({ title, body, cta, image, onPress, tint }: { title: string; body: string; cta: string; image: ImageSourcePropType; onPress: () => void; tint?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ width: 262, height: 150, borderRadius: 26, overflow: "hidden", opacity: pressed ? 0.9 : 1, backgroundColor: "#16181C" })}>
      <Image source={image} resizeMode="cover" style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.85 }} />
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: tint ? "linear-gradient(100deg, rgba(185,90,20,.92) 0%, rgba(22,24,28,.35) 100%)" : "linear-gradient(100deg, rgba(10,10,12,.9) 0%, rgba(10,10,12,.2) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,.45)" }) }} />
      <View style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
        <View style={{ gap: 4, maxWidth: 170 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: "rgba(255,255,255,.82)", fontSize: 12, lineHeight: 16 }}>{body}</Text>
        </View>
        <View style={{ alignSelf: "flex-start", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#EC8638" }}><Text style={{ color: "#1A1410", fontSize: 12, fontWeight: "800" }}>{cta}</Text></View>
      </View>
    </Pressable>
  );
}

export function PhotoCard({ media, title, pill, onPress, hearted = true }: { media: ReactNode; title: string; pill?: string | undefined; onPress: () => void; hearted?: boolean }) {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minWidth: 0, borderRadius: 22, overflow: "hidden", ...glassSurface, aspectRatio: 0.82 }}>
      <View style={{ position: "absolute", width: "100%", height: "100%" }}>{media}</View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.25)" }) }} />
      <View style={{ position: "absolute", left: 12, right: hearted ? 44 : 12, top: 12 }}>
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{title}</Text>
      </View>
      {hearted ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={() => setLiked(!liked)} hitSlop={8} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: liked ? "#E5484D" : "#9A9AA0", fontSize: 16, marginTop: -1 }}>{liked ? "\u2665" : "\u2661"}</Text>
        </Pressable>
      ) : null}
      {pill ? <View style={{ position: "absolute", right: 10, bottom: 10, borderRadius: 12, ...glassOrange, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: "#1A1410", fontSize: 11, fontWeight: "700" }}>{pill}</Text></View> : null}
    </Pressable>
  );
}

function ServiceCard({ s, onPress }: { s: HomeService; onPress: () => void }) {
  const img = (serviceImagery as Record<string, ImageSourcePropType>)[s.category] ?? serviceImagery.other;
  return <PhotoCard title={s.name} pill={s.price === "Quote on request" ? "Quote" : s.price} onPress={onPress} media={<Image source={img} resizeMode="cover" style={{ width: "100%", height: "100%" }} />} />;
}

export function GroupChips({ value, onChange }: { value: string | null; onChange: (k: string | null) => void }) {
  const { colors } = useExperienceTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 22, paddingRight: 8 }}>
      {GROUPS.map((c) => {
        const on = value === c.key;
        return (
          <Pressable key={c.label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(c.key)} style={{ paddingVertical: 6 }}>
            <Text style={{ color: on ? colors.accentStrong : colors.textSecondary, fontSize: 15, fontWeight: on ? "700" : "500" }}>{c.label}</Text>
            {on ? <View style={{ height: 2, borderRadius: 1, backgroundColor: ACCENT, marginTop: 4 }} /> : <View style={{ height: 2, marginTop: 4 }} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
export const groupCategories = (key: string | null): string[] => GROUPS.find((g) => g.key === key)?.cats ?? [];

export function HomeView(p: HomeViewProps) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const [chip, setChip] = useState<string | null>(p.initialChip ?? null);
  const cats = groupCategories(chip);
  const shown = p.services.filter((s) => !chip || cats.includes(s.category));
  const byBrand = chip === "coatings" || chip === "ppf";
  const visible = chip === null ? shown.slice(0, 4) : shown;
  const chunk = (xs: HomeService[]) => { const rr: HomeService[][] = []; for (let i = 0; i < xs.length; i += 2) rr.push(xs.slice(i, i + 2)); return rr; };
  const brandGroups: Array<[string, HomeService[]]> = [];
  if (byBrand) for (const sv of visible) { const k = sv.brand?.trim() || "Other"; const g = brandGroups.find(([n]) => n === k); if (g) g[1].push(sv); else brandGroups.push([k, [sv]]); }
  const renderRows = (xs: HomeService[]) => chunk(xs).map((row, i) => (
    <View key={i} style={{ flexDirection: "row", gap: 12 }}>
      {row.map((s) => <ServiceCard key={s.id} s={s} onPress={() => p.onService(s)} />)}
      {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
    </View>
  ));
  const car = p.cars[0];
  const heroImg: ImageSourcePropType = car?.photo ? { uri: car.photo } : ((vehicleImagery as Record<string, ImageSourcePropType>)[car?.category ?? "sedan"] ?? vehicleImagery.sedan);
  const fade = Platform.OS === "web" ? ({ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, ${name === "light" ? "rgba(232,234,237,0.95)" : "rgba(15,16,19,0.95)"} 100%)` } as object) : {};
  const pct = p.progress;
  return (
    <View style={{ gap: 20, paddingBottom: 120 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={p.onMenu} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <Icon name="menu" color={colors.textPrimary} size={22} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{car ? car.title : p.greeting}</Text>
          <Text numberOfLines={1} style={{ color: colors.textTertiary, fontSize: 12 }}>{car ? p.stage : "Add your car to begin"}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={p.unread > 0 ? `Notifications, ${p.unread} unread` : "Notifications"} onPress={p.onBell} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <Icon name="bell" color={colors.textPrimary} size={21} />
          {p.unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={p.onAvatar} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.roundOn }}>
          <Text style={{ color: "#1A1410", fontSize: 18, fontWeight: "800" }}>{p.initial}</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={car ? `${car.title}, care map` : "Add a car"} onPress={car ? p.onCareMap : p.onAddCar} style={{ height: 210, borderRadius: 30, overflow: "hidden", ...r.sheet }}>
        <Image source={heroImg} resizeMode="cover" style={{ position: "absolute", width: "100%", height: "100%" }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...fade }} />
        <View style={{ position: "absolute", left: 14, bottom: 14, flexDirection: "row", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, ...r.quiet }}>
            <Icon name="car" color="#EC8638" size={16} />
            <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{car ? "Care map" : "Add a car"}</Text>
          </View>
          {car ? <View style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, ...r.quiet }}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>{car.plate}</Text></View> : null}
        </View>
      </Pressable>

      {p.banner}

      <View style={{ flexDirection: "row", gap: 14, alignItems: "stretch" }}>
        <Tile title={p.live?.kicker ?? "Visit"} style={{ flex: 1.45 }} onPress={p.live?.onPress ?? p.onVisits}>
          <Text numberOfLines={1} style={{ color: colors.textTertiary, fontSize: 11 }}>{p.live ? p.live.detail : "No visit booked"}</Text>
          <View style={{ height: 10, overflow: "hidden", ...r.well, borderRadius: 6 }}>
            <View style={{ width: `${pct ?? 0}%`, height: "100%", borderRadius: 6, backgroundColor: "#EC8638" }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "800" }}>{pct !== null ? `${pct}%` : "-"}</Text>
            <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 12, textAlign: "right", flexShrink: 1, maxWidth: 90 }}>{p.live ? p.live.title : "Book now"}</Text>
          </View>
        </Tile>
        <Tile title="Car health" style={{ flex: 1 }} onPress={p.onCareMap}>
          <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, ...r.well, borderRadius: 12 }}><Text style={{ color: p.health.ok ? "#2E9E6B" : "#EC8638", fontSize: 12, fontWeight: "800" }}>{p.health.label}</Text></View>
          <View style={{ alignItems: "flex-end", marginTop: "auto" as never }}>
            <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", ...r.round }}><Icon name={p.health.ok ? "check" : "shield"} color={p.health.ok ? "#2E9E6B" : "#EC8638"} size={20} /></View>
          </View>
        </Tile>
      </View>

      <View style={{ flexDirection: "row", gap: 6 }}>
        <Round icon="calendar" label="Book" on onPress={p.onBook} />
        <Round icon="phone" label="Call" onPress={p.onCall} />
        <Round icon="chat" label="WhatsApp" onPress={p.onWhatsApp} />
        <Round icon="bookings" label="Visits" onPress={p.onVisits} />
      </View>

      <View style={{ flexDirection: "row", gap: 14, alignItems: "stretch" }}>
        <Tile title="Studio" style={{ flex: 1 }} onPress={p.onStudio}>
          <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", ...r.well, borderRadius: 17 }}><Icon name="garage" color="#EC8638" size={18} /></View>
          <Text numberOfLines={3} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>{p.studio.address}</Text>
          <Text numberOfLines={2} style={{ color: colors.textTertiary, fontSize: 11 }}>{p.studio.hours}</Text>
        </Tile>
        <Tile title={p.membership ? "Membership" : "Join the club"} style={{ flex: 1 }} onPress={p.onMembership}>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "800" }} numberOfLines={1}>{p.membership ? p.membership.title : "Wash plans"}</Text>
          <Text numberOfLines={3} style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>{p.membership ? p.membership.detail : "Regular washes at a better rate."}</Text>
          <View style={{ alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, ...r.quiet }}><Text style={{ color: colors.accentStrong, fontSize: 12, fontWeight: "800" }}>{p.membership ? "Open" : "See plans"}</Text></View>
        </Tile>
      </View>

      {p.stories}

      <View style={{ gap: 12 }}>
        <Heading title="From the studio" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8, paddingBottom: 14 }}>
          <Brand title="Protect the paint" body="Paint protection film, fitted in the studio." cta="Explore PPF" image={serviceImagery.ppf} onPress={() => { setChip("ppf"); p.onCategory("ppf"); }} tint />
          <Brand title="Ceramic season" body="Coatings that keep the shine." cta="See coatings" image={serviceImagery.ceramic} onPress={() => { setChip("coatings"); p.onCategory("coatings"); }} />
          <Brand title="Bring a friend" body="Share AutoDeck with someone who loves their car." cta="Share" image={sceneImagery.membership} onPress={p.onShare} tint />
        </ScrollView>
      </View>

      {p.cars.length > 1 ? (
        <View style={{ gap: 12 }}>
          <Heading title="Your garage" action="See all" onAction={() => p.cars[0] && p.onCar(p.cars[0])} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 8, paddingBottom: 10 }}>
            {p.cars.map((c) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.title} onPress={() => p.onCar(c)} style={{ alignItems: "center", gap: 6, width: 76 }}>
                <View style={{ width: 66, height: 66, borderRadius: 33, overflow: "hidden", ...r.round }}>
                  <Image source={c.photo ? { uri: c.photo } : ((vehicleImagery as Record<string, ImageSourcePropType>)[c.category ?? "sedan"] ?? vehicleImagery.sedan)} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
                </View>
                <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{c.title}</Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Add a car" onPress={p.onAddCar} style={{ alignItems: "center", gap: 6, width: 76 }}>
              <View style={{ width: 66, height: 66, alignItems: "center", justifyContent: "center", ...r.well, borderRadius: 33 }}><Text style={{ color: "#EC8638", fontSize: 28, marginTop: -2 }}>+</Text></View>
              <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Add car</Text>
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Heading title="Popular services" action="View all" onAction={p.onAllServices} />
        <GroupChips value={chip} onChange={(k) => { setChip(k); p.onCategory(k); }} />
        {byBrand
          ? brandGroups.map(([brand, xs]) => (
              <View key={brand} style={{ gap: 10 }}>
                <Text style={{ color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{brand}</Text>
                {renderRows(xs)}
              </View>
            ))
          : renderRows(visible)}
        {visible.length === 0 ? <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Nothing here yet.</Text> : null}
      </View>

      {p.reminders.length ? (
        <View style={{ gap: 12 }}>
          <Heading title="Reminders" />
          {p.reminders.map((rm) => (
            <Pressable key={rm.title} accessibilityRole="button" onPress={p.onReminders} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, padding: 14, ...r.card }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{rm.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{rm.detail}</Text>
              </View>
              <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: rm.danger ? "rgba(229,72,77,.16)" : colors.accentHaze }}>
                <Text style={{ color: rm.danger ? "#D6383E" : colors.accentStrong, fontSize: 12, fontWeight: "800" }}>{rm.chip}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

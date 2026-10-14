// Customer Home in the reference layout: round menu + car and status + bell and
// avatar, a car hero, visit and health tiles, four round actions, studio and
// membership tiles, stories, brand widgets, popular services and reminders.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Platform, Pressable, ScrollView, Text, View, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { serviceImagery } from "../lib/imagery";
import { raised } from "../lib/raised";

export type HomeCar = { id: string; title: string; plate: string; photo?: string | null; category?: string | null; hasPhoto?: boolean };
export type HomeService = { id: string; category: string; name: string; price: string; brand?: string | null };
export type HomeReminder = { title: string; detail: string; chip: string; danger: boolean };
export type HomeLive = { kicker: string; title: string; detail: string; onPress: () => void; idle?: boolean };
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
  membership: { title: string; detail: string } | null;
  studio: { address: string; hours: string };
  banner?: ReactNode;
  initialChip?: string | null;
  stories?: ReactNode;
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
  onStudio: () => void;
  onMembership: () => void;
  onVisits: () => void;
  onShare: () => void;
};

import { glassSurface, glassInner } from "../lib/glass";
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

export function PhotoCard({ media, title, pill, onPress, hearted = true }: { media: ReactNode; title: string; pill?: string | undefined; onPress: () => void; hearted?: boolean }) {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minWidth: 0, borderRadius: 24, overflow: "hidden", ...glassSurface, aspectRatio: 0.82 }}>
      <View style={{ position: "absolute", width: "100%", height: "100%" }}>{media}</View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.25)" }) }} />
      <View style={{ position: "absolute", left: 12, right: hearted ? 44 : 12, top: 12 }}>
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{title}</Text>
      </View>
      {hearted ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={() => setLiked(!liked)} hitSlop={8} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: liked ? "#E5484D" : "#9A9AA0", fontSize: 16, marginTop: -1 }}>{liked ? "\u2665" : "\u2661"}</Text>
        </Pressable>
      ) : null}
      {pill ? <View style={{ position: "absolute", right: 10, bottom: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: "#F59A4E", fontSize: 11, fontWeight: "700" }}>{pill}</Text></View> : null}
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

const glassBg = (night: boolean) => (Platform.OS === "web" ? ({ backgroundImage: night ? "linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.015) 45%, rgba(236,134,56,.07) 100%)" : "linear-gradient(135deg, rgba(255,255,255,.9) 0%, rgba(255,255,255,.4) 100%)" } as object) : {});

/** The car card when there is no photo of the customer's own car: a quiet glass panel with the plate, never a stock photo of someone else's car. */
function CarPanel({ title, plate, cta }: { title: string; plate: string; cta: string }) {
  const { name, colors } = useExperienceTheme();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, padding: 18, justifyContent: "space-between", ...glassBg(name !== "light") }}>
      <Icon name="car" color={colors.textTertiary} size={30} />
      <View style={{ gap: 6 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>{title}</Text>
        {plate ? <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "700", letterSpacing: 2 }}>{plate}</Text> : null}
        {cta ? <Text style={{ color: colors.accentStrong, fontSize: 12, fontWeight: "700" }}>{cta}</Text> : null}
      </View>
    </View>
  );
}

/** One lead card that changes with the car's state: live job, something needing action, a document due, or a prompt to book. */
function LeadCard({ live, pct, reminder, car, onReminder, onBook }: { live: HomeLive | null; pct: number | null; reminder: HomeReminder | null; car: HomeCar | undefined; onReminder: () => void; onBook: () => void }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const idle = !live || (live.idle === true && !reminder);
  const kicker = reminder ? "Needs attention" : idle ? "Ready when you are" : live!.kicker;
  const title = reminder ? `${reminder.title}: ${reminder.chip}` : idle ? (car ? `Book care for your ${car.title}` : "Add your car to begin") : live!.title;
  const detail = reminder ? reminder.detail : idle ? (live?.detail ?? "") : live!.detail;
  const press = reminder ? onReminder : idle ? (live?.onPress ?? onBook) : live!.onPress;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={press} style={({ pressed }) => ({ borderRadius: 24, padding: 18, gap: 10, opacity: pressed ? 0.9 : 1, ...r.card, ...glassBg(name !== "light") })}>
      <Text style={{ color: colors.accentStrong, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>{kicker}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800", lineHeight: 28 }}>{title}</Text>
      {detail ? <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{detail}</Text> : null}
      {!reminder && !idle && pct !== null ? (
        <View style={{ height: 8, overflow: "hidden", ...r.well, borderRadius: 6 }}>
          <View style={{ width: `${pct}%`, height: "100%", borderRadius: 6, backgroundColor: "#EC8638" }} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Up to three services, one per category, from the live catalogue only. */
export function pickSuggested(all: HomeService[]): HomeService[] {
  const seen = new Set<string>();
  const out: HomeService[] = [];
  for (const sv of all) { if (seen.has(sv.category)) continue; seen.add(sv.category); out.push(sv); if (out.length === 3) break; }
  return out;
}

function SuggestRow({ s, first, onPress }: { s: HomeService; first: boolean; onPress: () => void }) {
  const { colors } = useExperienceTheme();
  const img = (serviceImagery as Record<string, ImageSourcePropType>)[s.category] ?? serviceImagery.other;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={s.name} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 12, opacity: pressed ? 0.8 : 1, borderTopWidth: first ? 0 : 1, borderTopColor: colors.borderSubtle })}>
      <Image source={img} resizeMode="cover" style={{ width: 56, height: 56, borderRadius: 16 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{s.name}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>{s.price === "Quote on request" ? "Quote on request" : s.price}</Text>
      </View>
    </Pressable>
  );
}

function ClubRow({ icon, title, sub, onPress, first }: { icon: IconName; title: string; sub: string; onPress: () => void; first?: boolean }) {
  const { colors } = useExperienceTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, opacity: pressed ? 0.8 : 1, borderTopWidth: first ? 0 : 1, borderTopColor: colors.borderSubtle })}>
      <Icon name={icon} color="#EC8638" size={20} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

// Garage cars as one endless horizontal strip: three copies, re-centred after each swipe.
function GarageCarousel({ cars, onOpen, onAdd, onActive }: { cars: HomeCar[]; onOpen: (c: HomeCar) => void; onAdd: () => void; onActive: (i: number) => void }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const [w, setW] = useState(0);
  const ref = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = cars.length;
  const loop = n > 1;
  const card = w > 0 ? Math.min(w - 36, 420) : 0, step = card + 12;
  const items = loop ? [...cars, ...cars, ...cars] : cars;
  useEffect(() => { if (loop && step > 12) ref.current?.scrollTo({ x: n * step, animated: false }); }, [loop, step, n]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const settle = (x: number) => {
    const i = Math.round(x / step);
    onActive(((i % n) + n) % n);
    if (i < n) ref.current?.scrollTo({ x: x + n * step, animated: false });
    else if (i >= 2 * n) ref.current?.scrollTo({ x: x - n * step, animated: false });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(x), 140);
  };
  const fade = Platform.OS === "web" ? ({ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, ${name === "light" ? "rgba(232,234,237,0.95)" : "rgba(15,16,19,0.95)"} 100%)` } as object) : {};
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 210 }}>
      {w > 0 ? (
        n === 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add a car" onPress={onAdd} style={{ height: 210, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden", ...r.sheet }}>
            <CarPanel title="Your car goes here" plate="" cta="Add a car" />
            <View style={{ position: "absolute", left: 14, bottom: 14, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, ...r.quiet }}>
              <Icon name="car" color="#EC8638" size={16} /><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>Add a car</Text>
            </View>
          </Pressable>
        ) : (
          <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} snapToInterval={loop ? step : undefined} decelerationRate="fast" scrollEventThrottle={32} onScroll={loop ? onScroll : undefined} contentContainerStyle={{ gap: 12 }}>
            {items.map((c, i) => (
              <Pressable key={`${c.id}-${i}`} accessibilityRole="button" accessibilityLabel={`${c.title}, care map`} onPress={() => onOpen(c)} style={{ width: loop ? card : w, height: 210, borderRadius: 24, overflow: "hidden", ...r.sheet }}>
                {c.photo ? <Image source={{ uri: c.photo }} resizeMode="cover" style={{ position: "absolute", width: "100%", height: "100%" }} /> : <CarPanel title={c.title} plate={c.plate} cta={c.hasPhoto === false ? "Add a photo in Garage" : ""} />}
                {c.photo ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...fade }} /> : null}
                <View style={{ position: "absolute", left: 14, bottom: 14, flexDirection: "row", gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, ...r.quiet }}>
                    <Icon name="car" color="#EC8638" size={16} /><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>Care map</Text>
                  </View>
                  <View style={{ borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, ...r.quiet }}><Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>{c.plate}</Text></View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : null}
    </View>
  );
}

export function HomeView(p: HomeViewProps) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const suggested = pickSuggested(p.services);
  const [active, setActive] = useState(0);
  const car = p.cars[active] ?? p.cars[0];
  const pct = p.progress;
  return (
    <View style={{ gap: 20, paddingBottom: 120 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={p.onAvatar} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <Text style={{ color: colors.accentStrong, fontSize: 18, fontWeight: "800" }}>{p.initial}</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{car ? car.title : p.greeting}</Text>
          <Text numberOfLines={1} style={{ color: colors.textTertiary, fontSize: 12 }}>{car ? p.stage : "Add your car to begin"}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={p.unread > 0 ? `Notifications, ${p.unread} unread` : "Notifications"} onPress={p.onBell} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <Icon name="bell" color={colors.textPrimary} size={21} />
          {p.unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
        </Pressable>
      </View>

      {p.stories}

      <GarageCarousel cars={p.cars} onOpen={(c) => p.onCar(c)} onAdd={p.onAddCar} onActive={setActive} />

      {p.banner}

      <LeadCard live={p.live} pct={pct} reminder={p.live?.idle ? p.reminders[0] ?? null : null} car={car} onReminder={p.onReminders} onBook={p.onBook} />

      <View style={{ gap: 12 }}>
        <Heading title={car ? `For your ${car.title}` : "Services"} action="All services" onAction={p.onAllServices} />
        <View style={{ borderRadius: 24, overflow: "hidden", ...r.card }}>
          {suggested.map((sv, i) => <SuggestRow key={sv.id} s={sv} first={i === 0} onPress={() => p.onService(sv)} />)}
          {suggested.length === 0 ? <Text style={{ color: colors.textTertiary, fontSize: 14, padding: 16 }}>Services will show here.</Text> : null}
        </View>
      </View>

      {p.reminders.length ? (
        <View style={{ gap: 12 }}>
          <Heading title="Reminders" />
          {p.reminders.map((rm) => (
            <Pressable key={rm.title} accessibilityRole="button" onPress={p.onReminders} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 24, padding: 14, ...r.card }}>
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
      <View style={{ gap: 12 }}>
        <Heading title="Studio and club" />
        <View style={{ borderRadius: 24, overflow: "hidden", ...r.card }}>
          <ClubRow first icon="membership" title={p.membership ? `Membership, ${p.membership.title}` : "Join the club"} sub={p.membership ? p.membership.detail : "Regular washes at a better rate."} onPress={p.onMembership} />
          <ClubRow icon="gift" title="Bring a friend" sub="Share AutoDeck with someone who loves their car." onPress={p.onShare} />
          <ClubRow icon="pin" title="The studio" sub={`${p.studio.address}. ${p.studio.hours}`} onPress={p.onStudio} />
        </View>
      </View>
    </View>
  );
}

// Customer Home in the reference layout: round menu + car and status + bell and
// avatar, a car hero, visit and health tiles, four round actions, studio and
// membership row, stories and follow links. One entry point per thing: services live in the Services tab, papers in Car.
import { CarThumb } from "./CarThumb";
import { liveStep } from "../lib/live-step";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Platform, useWindowDimensions, Pressable, ScrollView, Text, View, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { pickTopServices, type TopPick } from "../lib/top-services";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import type { NavIconName } from "./NavIcon";
import { serviceImagery } from "../lib/imagery";
import { raised } from "../lib/raised";
import { metrics } from "../lib/metrics";
import { glassPane } from "../lib/glass-pane";
import { Plate } from "./kit";
import { ServicePhoto } from "./ServicePhoto";
import { NavIcon, navIconFor } from "./NavIcon";
import { HomeBackdrop } from "./HomeBackdrop";
import { SideDrawer, type DrawerItem } from "./SideDrawer";
import type { Vehicle } from "@autodeck/core";
import { CampaignSlot } from "./CampaignSlot";
import { CarsCard } from "./CarsCard";
import { CarChips } from "./CarChips";
import type { CarListingView } from "@autodeck/core";
import type { Campaign } from "../lib/campaign";

export type HomeCar = { id: string; title: string; plate: string; /** The vehicle record. Photo comes from the same source as Garage (CarThumb), for every car. */ vehicle?: Pick<Vehicle, "photoUrl" | "category"> & { updatedAt?: string }; category?: string | null; hasPhoto?: boolean };
export type HomeService = { id: string; category: string; name: string; price: string; brand?: string | null };
export type HomeReminder = { title: string; detail: string; chip: string; danger: boolean };
export type HomeLive = { kicker: string; title: string; detail: string; onPress: () => void; idle?: boolean; /** Expected ready time, shown only when set and still ahead. */ ready?: string | null };
export type HomeViewProps = {
  rebook?: { serviceName: string; onPress: () => void } | null;
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
  studio: { address: string; hours: string; openText?: string | null; open?: boolean };
  /** What the car is due for, from its delivered visits. Null hides the card. */
  /** Social rows under Studio and club. Empty values hide the row. */
  social?: Array<{ key: string; title: string; sub: string; icon: NavIconName; onPress: () => void }>;
  need?: { title: string; detail: string; onPress: () => void } | null;
  /** One-tap studio contact: Call, WhatsApp, Directions. Empty hides the row. */
  quick?: Array<{ key: string; label: string; icon: NavIconName; onPress: () => void }>;
  banner?: ReactNode;
  initialChip?: string | null;
  stories?: ReactNode;
  /** One compact campaign slot. Omit until there is real content. */
  campaign?: Campaign | null;
  /** A live car listing for the Cars card. Null hides it. */
  carsList?: CarListingView[];
  onOpenCar?: (id: string) => void;
  onBuyCar?: () => void;
  onSellCar?: () => void;
  onAvatar: () => void;
  /** Shortcuts shown in the side drawer opened from the avatar. */
  drawer?: DrawerItem[];
  displayName?: string;
  onSearch: () => void;
  onBell: () => void;
  onAllServices: () => void;
  onCategory: (category: string | null) => void;
  onService: (s: HomeService) => void;
  onCar: (c: HomeCar) => void;
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
      {action ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600" }}>{action}</Text></Pressable> : null}
    </View>
  );
}

function Round({ icon, label, onPress, on, badge }: { icon: IconName; label: string; onPress: () => void; on?: boolean; badge?: boolean }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ alignItems: "center", gap: 8, opacity: pressed ? 0.75 : 1, flex: 1 })}>
      <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center", ...(on ? r.roundOn : r.round) }}>
        <NavIcon name={navIconFor(icon)} color={on ? "#1A1410" : colors.textPrimary} size={24} cut="#18181C" />
        {badge ? <View style={{ position: "absolute", top: 14, right: 16, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** The one tile size used on Services, Garage, Home Top services and Bookings Explore. */
export const TILE_ASPECT = 1.4;
export const TILE_GAP = 10;

export function PhotoCard({ media, title, pill, onPress, hearted = true }: { media: ReactNode; title: string; pill?: string | undefined; onPress: () => void; hearted?: boolean }) {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minWidth: 0, borderRadius: 24, overflow: "hidden", ...glassSurface, aspectRatio: TILE_ASPECT }}>
      <View style={{ position: "absolute", width: "100%", height: "100%" }}>{media}</View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.25)" }) }} />
      <View style={{ position: "absolute", left: 12, right: hearted ? 44 : 12, top: 10 }}>
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>{title}</Text>
      </View>
      {hearted ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={() => setLiked(!liked)} hitSlop={8} style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: liked ? "#E5484D" : "#9A9AA0", fontSize: 16, marginTop: -1 }}>{liked ? "\u2665" : "\u2661"}</Text>
        </Pressable>
      ) : null}
      {pill ? <View style={{ position: "absolute", right: 10, bottom: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{pill}</Text></View> : null}
    </Pressable>
  );
}

function ServiceCard({ s, onPress }: { s: HomeService; onPress: () => void }) {
  const img = (serviceImagery as Record<string, ImageSourcePropType>)[s.category] ?? serviceImagery.other;
  return <PhotoCard title={s.name} pill={s.price === "Quote on request" ? "Quote" : s.price || undefined} onPress={onPress} media={<Image source={img} resizeMode="cover" style={{ width: "100%", height: "100%" }} />} />;
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

const glassBg = (night: boolean) => (Platform.OS === "web" ? ({ backgroundImage: night ? "linear-gradient(135deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,.015) 45%, rgba(236,134,56,.07) 100%)" : "none" } as object) : {});

/** One lead card that changes with the car's state: live job, something needing action, a document due, or a prompt to book. */
type IdleNudge = { kicker: string; title: string; detail: string; cta: string; onPress: () => void };
/** The one thing Home nudges about when nothing is live: an expiring paper first, then what the car needs, then a rebook. */
export function pickIdleNudge(p: { reminder: HomeReminder | null; need?: { title: string; detail: string; onPress: () => void } | null | undefined; rebook?: { serviceName: string; onPress: () => void } | null | undefined; onReminder: () => void }): IdleNudge | null {
  if (p.reminder) return { kicker: "Needs attention", title: `${p.reminder.title}: ${p.reminder.chip}`, detail: p.reminder.detail, cta: "Take a look", onPress: p.onReminder };
  if (p.need) return { kicker: "Your car needs", title: p.need.title, detail: p.need.detail, cta: "Book", onPress: p.need.onPress };
  if (p.rebook) return { kicker: "Last time", title: p.rebook.serviceName, detail: "", cta: "Book again", onPress: p.rebook.onPress };
  return null;
}
function LeadCard({ live, pct, nudge, car, onBook }: { live: HomeLive | null; pct: number | null; nudge: IdleNudge | null; car: HomeCar | undefined; onBook: () => void }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const idle = !live || live.idle === true;
  const n = idle ? nudge : null;
  const kicker = n ? n.kicker : idle ? "Ready when you are" : live!.kicker;
  const title = n ? n.title : idle ? (car ? `Book care for your ${car.title}` : "Add your car to begin") : live!.title;
  const detail = n ? n.detail : idle ? (live?.detail ?? "") : live!.detail;
  const press = n ? n.onPress : idle ? (live?.onPress ?? onBook) : live!.onPress;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={press} style={({ pressed }) => ({ borderRadius: metrics.cardRadius, padding: metrics.cardPad, gap: 8, opacity: pressed ? 0.9 : 1, ...glassPane(name === "light"), ...glassBg(name !== "light") })}>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>{kicker}</Text>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800", lineHeight: 28 }}>{title}</Text>
      {detail ? <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>{detail}</Text> : null}
      {!idle && pct !== null ? (
        <View style={{ height: 8, overflow: "hidden", ...r.well, borderRadius: 6 }}>
          <View style={{ width: `${pct}%`, height: "100%", borderRadius: 6, backgroundColor: colors.textPrimary }} />
        </View>
      ) : null}
      <View style={{ alignSelf: "flex-start", marginTop: 4, borderRadius: 9999, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: "#F4F2EF" }}>
        <Text style={{ color: "#0B0B0D", fontSize: 15, fontWeight: "800" }}>{n ? n.cta : idle ? (car ? "Book a service" : "Add your car") : live!.kicker === "Needs your OK" ? "Review" : "Track"}</Text>
      </View>
    </Pressable>
  );
}

/** Slot 1 while a car is in the studio: the live job with the car inside it. Replaces the car chip, so "in studio" is said once. */
const LIVE_STEPS = ["Received", "In progress", "Final checks", "Ready"];

/** Live visit: the car photo fills the card, with the step, the four-step bar, ready-by and one Track button. */
function LiveCard({ live, pct, car }: { live: HomeLive; pct: number | null; car: HomeCar | undefined }) {
  const step = liveStep(pct);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={live.title} onPress={live.onPress} style={({ pressed }) => ({ borderRadius: 24, overflow: "hidden", minHeight: 236, backgroundColor: "#0B0B0D", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", opacity: pressed ? 0.92 : 1 })}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <CarThumb car={car?.vehicle} height={300} radius={0} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.2) 35%, rgba(0,0,0,.88) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.4)" }) }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
        <View style={{ backgroundColor: "#EC8638", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: "#1A1410", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>LIVE</Text></View>
        {car?.plate ? <Plate value={car.plate} /> : null}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ padding: 16, gap: 10 }}>
        <Text numberOfLines={1} style={{ color: "#E4E2DF", fontSize: 13 }}>{[car?.title, live.detail].filter(Boolean).join(" \u00b7 ")}</Text>
        <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "800", lineHeight: 30 }}>{live.title}</Text>
        <View accessibilityRole="progressbar" accessibilityLabel={`Step ${step + 1} of 4`} style={{ flexDirection: "row", gap: 6 }}>
          {LIVE_STEPS.map((n, i) => (
            <View key={n} style={{ flex: 1, gap: 6 }}>
              <View style={{ height: 5, borderRadius: 9999, backgroundColor: i <= step ? "#FFFFFF" : "rgba(255,255,255,0.28)" }} />
              <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 10.5, opacity: i <= step ? 1 : 0.6, fontWeight: i === step ? "700" : "500" }}>{n}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <Text numberOfLines={1} style={{ color: "#E4E2DF", fontSize: 13, flex: 1 }}>{live.ready ? `Ready by ${live.ready}` : ""}</Text>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: "#111111", fontSize: 13, fontWeight: "700" }}>Track</Text></View>
        </View>
      </View>
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

export type { TopPick } from "../lib/top-services";
function TopPickCard({ pick, onPress }: { pick: TopPick; onPress: () => void }) {
  const price = pick.service.price === "Quote on request" ? "Quote" : pick.service.price ? `From ${pick.service.price.replace(/^From\s+/i, "")}` : undefined;
  return (
    <PhotoCard hearted={false} title={pick.title} pill={price} onPress={onPress} media={<ServicePhoto service={{ name: pick.service.name, category: pick.service.category, brand: pick.service.brand ?? null }} height={400} />} />
  );
}

function SuggestRow({ s, first, onPress }: { s: HomeService; first: boolean; onPress: () => void }) {
  const { colors } = useExperienceTheme();
  const img = (serviceImagery as Record<string, ImageSourcePropType>)[s.category] ?? serviceImagery.other;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={s.name} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: metrics.rowPadV, paddingHorizontal: metrics.rowPadH, opacity: pressed ? 0.8 : 1, borderTopWidth: first ? 0 : 1, borderTopColor: colors.borderSubtle })}>
      <Image source={img} resizeMode="cover" style={{ width: metrics.thumb, height: metrics.thumb, borderRadius: 12 }} />
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
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: metrics.rowPadV, paddingHorizontal: metrics.rowPadH, opacity: pressed ? 0.8 : 1, borderTopWidth: first ? 0 : 1, borderTopColor: colors.borderSubtle })}>
      <NavIcon name={navIconFor(icon)} color={colors.textSecondary} size={20} cut="#18181C" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
        <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

/** One car gets the hero stage, with or without a photo. */
export function isCompactCarRow(cars: HomeCar[]): boolean { return cars.length === 1; }

export function HomeView(p: HomeViewProps) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const narrow = useWindowDimensions().width < 350;
  const top = pickTopServices(p.services);
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(false);
  const car = p.cars[active] ?? p.cars[0];
  const pct = p.progress;
  const liveOn = !!p.live && p.live.idle !== true;
  return (
    <View style={{ gap: metrics.sectionGap, paddingBottom: 100 }}>
      <HomeBackdrop />
      {p.drawer?.length ? <SideDrawer open={menu} onClose={() => setMenu(false)} name={p.displayName ?? "AutoDeck"} initial={p.initial} items={p.drawer} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => (p.drawer?.length ? setMenu(true) : p.onAvatar())} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "800" }}>{p.initial}</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800" }}>{p.greeting}</Text>
          <Text numberOfLines={1} style={{ color: "#D5D1CA", fontSize: 12 }}>{car ? p.stage : "Add your car to begin"}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={p.unread > 0 ? `Notifications, ${p.unread} unread` : "Notifications"} onPress={p.onBell} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", ...r.round }}>
          <NavIcon name="bell" color={colors.textPrimary} size={22} cut="#18181C" />
          {p.unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
        </Pressable>
      </View>

      {p.stories}

      {liveOn ? <LiveCard live={p.live!} pct={pct} car={car} /> : <CarChips cars={p.cars} active={active} onActive={setActive} onOpen={(c) => p.onCar(c)} onAdd={p.onAddCar} />}

      {p.banner}

      <LeadCard live={liveOn ? null : p.live} pct={pct} nudge={pickIdleNudge({ reminder: p.reminders[0] ?? null, need: p.need, rebook: p.rebook, onReminder: p.onReminders })} car={car} onBook={p.onBook} />

      {top.length ? (
        <View style={{ gap: 12 }}>
          <Heading title="Services for you" action="All" onAction={p.onAllServices} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: TILE_GAP }}>
            {top.map((t) => <View key={t.key} style={{ width: 168 }}><TopPickCard pick={t} onPress={() => p.onService(t.service)} /></View>)}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <Heading title="Club" />
        <View style={{ overflow: "hidden", ...glassPane(name === "light") }}>
          <ClubRow first icon="membership" title={p.membership ? `Membership, ${p.membership.title}` : "Join the club"} sub={p.membership ? p.membership.detail : "Regular washes at a better rate."} onPress={p.onMembership} />
        </View>
      </View>

      <CampaignSlot campaign={p.campaign} />
      {p.carsList && p.carsList.length > 0 && p.onOpenCar && p.onBuyCar && p.onSellCar ? <CarsCard cars={p.carsList} onOpen={p.onOpenCar} onBuy={p.onBuyCar} onSell={p.onSellCar} /> : null}
      <View style={{ gap: 12 }}>
        <Heading title="The studio" />
        <View style={{ ...glassPane(name === "light"), padding: metrics.cardPad, gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="The studio" onPress={p.onStudio} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <NavIcon name="pin" color={colors.textSecondary} size={20} cut="#18181C" />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              {p.studio.openText ? <Text style={{ color: p.studio.open === false ? colors.textSecondary : colors.accentStrong, fontSize: 13, fontWeight: "800" }}>{p.studio.openText}</Text> : null}
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{p.studio.address}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{p.studio.hours}</Text>
            </View>
          </Pressable>
          {p.quick?.length ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {p.quick.map((q) => (
                <Pressable key={q.key} accessibilityRole="button" accessibilityLabel={q.label} onPress={q.onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: pressed ? 0.8 : 1, ...r.round })}>
                  {narrow ? null : <NavIcon name={navIconFor(q.icon)} color={colors.textPrimary} size={16} cut="#18181C" />}
                  <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{q.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {(p.social ?? []).length ? (
        <View style={{ gap: 12 }}>
          <Heading title="Follow us" />
          <View style={{ flexDirection: narrow ? "column" : "row", gap: TILE_GAP }}>
            {(p.social ?? []).map((x) => (
              <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={x.title} onPress={x.onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, opacity: pressed ? 0.85 : 1, ...glassPane(name === "light") })}>
                <NavIcon name={x.icon} color={colors.accentStrong} size={22} cut="#18181C" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{x.title}</Text>
                  <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{x.sub}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

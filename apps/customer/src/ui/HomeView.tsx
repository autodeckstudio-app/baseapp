import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { MENU_CHIPS, MENU_GROUPS, type Vehicle, type CarListingView } from '@autodeck/core';
import type { NavIconName } from './NavIcon';
import type { DrawerItem } from './SideDrawer';
import type { Campaign } from '../lib/campaign';
import { glassSurface } from '../lib/glass';
import { HomeScene } from './HomeScene';
export type HomeCar = { id: string; title: string; plate: string; /** The vehicle record. Photo comes from the same source as Garage (CarThumb), for every car. */ vehicle?: Pick<Vehicle, "photoUrl" | "category"> & { updatedAt?: string }; category?: string | null; hasPhoto?: boolean; /** One real history line, e.g. the last delivered visit. Omitted when the car has none. */ story?: string | null };
export type HomeService = { id: string; category: string; name: string; price: string; brand?: string | null };
export type HomeReminder = { title: string; detail: string; chip: string; danger: boolean };
export type HomeLive = { kicker: string; title: string; detail: string; onPress: () => void; idle?: boolean; /** Expected ready time, shown only when set and still ahead. */ ready?: string | null };
export type HomeViewProps = {
  rebook?: { serviceName: string; onPress: () => void } | null;
  greeting: string;
  initial: string;
  unread: number;
  cars: HomeCar[];
  activeCarId?: string | undefined;
  services: HomeService[];
  reminders: HomeReminder[];
  live: HomeLive | null;
  /** 0 to 100 when a visit is under way, else null. */
  progress: number | null;
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
  onService: (s: HomeService, cardKey?: string) => void;
  onCar: (c: HomeCar) => void;
  onAddCar: () => void;
  onGarage: () => void;
  /** Changes the canonical Home vehicle, never just the displayed image. */
  onSelectCar?: (id: string) => void;
  onReminders: () => void;
  onBook: () => void;
  onStudio: () => void;
  onMembership: () => void;
  onVisits: () => void;
  onShare: () => void;
};

const ACCENT = "#EC8638";
void ACCENT;
// Popular-services groups. Ceramic lives under Coatings; tint is the one
// modification category today; inspection and other care sit under Garage.
const GROUPS: Array<{ key: string | null; label: string; cats: string[] }> = [
  { key: null, label: "All", cats: [] },
  ...MENU_CHIPS.map((k) => { const g = MENU_GROUPS.find((x) => x.key === k)!; return { key: k as string, label: g.key === "mods" ? "Modifications" : g.label, cats: g.categories as string[] }; }),
];
const TITLES: Record<string, string> = { washing: "Wash and care", ceramic: "Ceramic coating", coating: "Coating", ppf: "Paint protection film", tinting: "Window tint", inspection: "Inspection", other: "Care", garage: "Garage", modifications: "Modifications", pickup: "Pickup and drop" };

/** The one tile size used on Services, Garage, Home Top services and Bookings Explore. */
export const TILE_ASPECT = 1.4;
export const TILE_GAP = 10;

export function PhotoCard({ media, title, pill, onPress, hearted = true, mediaTreatment }: { media: ReactNode; title: string; pill?: string | undefined; onPress: () => void; hearted?: boolean; mediaTreatment?: "paper" | "logo-dark" | undefined }) {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ flex: 1, minWidth: 0, borderRadius: 24, overflow: "hidden", ...glassSurface, aspectRatio: TILE_ASPECT }}>
      <View style={{ position: "absolute", width: "100%", height: "100%" }}>{media}</View>
      {!mediaTreatment ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,.7) 100%)" } as object) : { backgroundColor: "rgba(0,0,0,0.25)" }) }} /> : null}
      <View style={{ position: "absolute", left: 12, right: hearted ? 44 : 12, top: 10 }}>
        <Text numberOfLines={2} style={{ color: mediaTreatment === "paper" ? "#17191C" : "#FFFFFF", fontSize: 13, fontWeight: "700" }}>{title}</Text>
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

type IdleNudge = { kicker: string; title: string; detail: string; cta: string; onPress: () => void };
/** The one thing Home nudges about when nothing is live: an expiring paper first, then what the car needs, then a rebook. */
export function pickIdleNudge(p: { reminder: HomeReminder | null; need?: { title: string; detail: string; onPress: () => void } | null | undefined; rebook?: { serviceName: string; onPress: () => void } | null | undefined; onReminder: () => void }): IdleNudge | null {
  if (p.reminder) return { kicker: "Needs attention", title: `${p.reminder.title}: ${p.reminder.chip}`, detail: p.reminder.detail, cta: "Take a look", onPress: p.onReminder };
  if (p.need) return { kicker: "Your car needs", title: p.need.title, detail: p.need.detail, cta: "Book", onPress: p.need.onPress };
  if (p.rebook) return { kicker: "Last time", title: p.rebook.serviceName, detail: "", cta: "Book again", onPress: p.rebook.onPress };
  return null;
}
export function pickSuggested(all: HomeService[]): HomeService[] {
  const seen = new Set<string>();
  const out: HomeService[] = [];
  for (const sv of all) { if (seen.has(sv.category)) continue; seen.add(sv.category); out.push(sv); if (out.length === 3) break; }
  return out;
}

export type { TopPick } from '../lib/top-services';
export function isCompactCarRow(cars: HomeCar[]): boolean { return cars.length === 1; }
export function HomeView(p: HomeViewProps) { return <HomeScene p={p} />; }

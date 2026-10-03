// Services: one screen, two levels. Sticky category chips, sub-group sections, search, compact rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { BRANDS, type BrandItem } from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Service } from "@autodeck/core";
import { space, type IconName } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, priceLabel } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { serviceVisual, brandHero } from "../../../lib/imagery";
import { Button, Chip, Kicker, Notice, Pane, Row, Screen, Skeleton, T, rupees } from "../../../ui/kit";

const GROUP: Record<string, string> = {
  washing: "Wash and care",
  ceramic: "Ceramic",
  coating: "Coatings",
  ppf: "Paint film",
  tinting: "Window film",
  inspection: "Inspection",
  other: "More",
};
// Order is deliberate: an easy first yes (wash), then the two "protect your investment" anchors
// (ceramic, paint film), then the budget coating shown after them, then practical add-ons.
const ORDER = ["washing", "ceramic", "ppf", "coating", "tinting", "inspection", "other"];
// Old "?need=" deep links map onto a category chip.
const NEED_TO_CAT: Record<string, string> = { wash: "washing", shine: "coating", ceramic: "ceramic", ppf: "ppf", tint: "tinting", check: "inspection" };

/** Second level: derived from the service itself (name, warranty) so new services slot in without a schema change. */
function subGroup(s: Service): string {
  const n = s.name.toLowerCase();
  switch (s.category) {
    case "washing":
      if (/interior|dry clean|spa|upholster|cabin|seat/.test(n)) return "Interior and detail";
      if (/wash|foam|exterior/.test(n)) return "Exterior wash";
      return "Finishing touches";
    case "ppf":
      if (/full|body|complete/.test(n)) return "Full body";
      if (/front|hood|bumper|bonnet|partial|fender/.test(n)) return "Front and partial";
      return s.brand ? `${s.brand} films` : "Film packages";
    case "ceramic":
    case "coating":
      if (s.warrantyLabel) return s.warrantyLabel.length > 24 ? "Warranty-backed" : `${s.warrantyLabel} protection`;
      return s.category === "ceramic" ? "Ceramic packages" : "Polish and coat";
    default:
      return GROUP[s.category] ?? "More";
  }
}

const ICON: Record<string, IconName> = { washing: "wash", ceramic: "ceramic", coating: "coating", ppf: "ppf", tinting: "tint", inspection: "inspect", other: "tools" };
const BLURB: Record<string, string> = {
  washing: "Quick, safe cleans",
  ceramic: "Deep gloss that lasts",
  coating: "Shine and easy upkeep",
  ppf: "Stone-chip armour",
  tinting: "Heat and privacy",
  inspection: "Know before you fix",
  other: "Extras",
};

function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 8 ? `${Math.round(h / 8)} day${h >= 16 ? "s" : ""}` : `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}

function fromPrice(xs: Service[]): string | null {
  const priced = xs.filter((x) => x.priceOnRequest !== true && x.basePrice > 0).map((x) => x.basePrice);
  return priced.length ? `From ${rupees(Math.min(...priced))}` : null;
}

export default function CatalogueScreen() {
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const { need, cat: catParam, brand: brandParam } = useLocalSearchParams<{ need?: string; cat?: string; brand?: string }>();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const cat = catParam ?? (need ? NEED_TO_CAT[need] : undefined);
  const brand = brandParam;

  const load = useCallback(async () => {
    setError(false);
    try {
      setServices(await getServiceCatalogue());
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const all = services ?? [];
  const cats = ORDER.filter((c) => all.some((x) => x.category === c));
  const byPrice = (a: Service, b: Service) => Number(a.priceOnRequest === true) - Number(b.priceOnRequest === true) || a.basePrice - b.basePrice;
  const groupName = (sv: Service) => sv.brand ?? BRANDS.find((b) => b.items.some((it) => sv.name.toLowerCase().includes(it.name.toLowerCase())))?.name ?? subGroup(sv);

  // Level 2: groups (brands, or sub-groups where a category has no brands) inside one category, easiest entry first.
  const groups = useMemo(() => {
    if (!cat) return [] as [string, Service[]][];
    const m = new Map<string, Service[]>();
    for (const sv of all.filter((x) => x.category === cat)) m.set(groupName(sv), [...(m.get(groupName(sv)) ?? []), sv]);
    return [...m.entries()].map(([k, v]) => [k, [...v].sort(byPrice)] as [string, Service[]]).sort((a, b) => byPrice(a[1][0]!, b[1][0]!));
  }, [all, cat]);

  const go = (params: Record<string, string>) => router.push({ pathname: "/(tabs)/catalogue", params });
  const t = q.trim().toLowerCase();
  const searching = t.length > 0;
  const found = searching ? all.filter((x) => `${x.name} ${x.brand ?? ""}`.toLowerCase().includes(t)).sort(byPrice) : [];
  // Skip a pointless level: one group means go straight to its products.
  const level: 1 | 2 | 3 = !cat ? 1 : brand || groups.length === 1 ? 3 : 2;
  const groupKey = brand ?? groups[0]?.[0];
  const products = level === 3 ? (groups.find(([k]) => k === groupKey)?.[1] ?? []) : [];

  const tile = (key: string, title: string, sub: string | undefined, meta: string | undefined, icon: IconName, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentHaze }}>
        <Icon name={icon} color={colors.accent} size={22} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T role="bodyStrong" numberOfLines={1}>{title}</T>
        {sub ? <T role="caption" tone="secondary" numberOfLines={2}>{sub}</T> : null}
        {meta ? <T role="caption" tone="accent" numberOfLines={1}>{meta}</T> : null}
      </View>
      <T tone="tertiary">›</T>
    </Pressable>
  );

  const card = (sv: Service) => (
    <Pressable key={sv.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} style={({ pressed }) => ({ width: "47.5%", opacity: pressed ? 0.85 : 1 })}>
      <View>
        <ServicePhoto service={sv} height={190} radius={22} />
        {sv.warrantyLabel ? (
          <View style={{ position: "absolute", left: 8, bottom: 8, maxWidth: "88%", borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 10, paddingVertical: 4 }}>
            <T role="caption" tone="accent" numberOfLines={1}>{sv.warrantyLabel}</T>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 8, gap: 2 }}>
        <T role="bodyStrong" numberOfLines={2}>{sv.name.replace(/^Kovalent\s+/i, "")}</T>
        <T role="caption" tone="tertiary" numberOfLines={1}>{duration(sv.estimatedDurationMinutes)}</T>
        <T role="bodyStrong" tone="accent" numberOfLines={1}>{priceLabel(sv)}</T>
      </View>
    </Pressable>
  );

  const crumb = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ alignSelf: "flex-start" }}>
      <T role="caption" tone="accent">‹ {label}</T>
    </Pressable>
  );

  const top = (
    <View style={{ gap: space.line }}>
      <View style={{ gap: space.hair }}>
        {level === 3 && groups.length > 1 && cat ? crumb(GROUP[cat] ?? "Services", () => go({ cat })) : level >= 2 && cat ? crumb("All services", () => router.push("/(tabs)/catalogue")) : null}
        <Kicker tone="accent">{cat ? GROUP[cat] ?? "Services" : "Services"}</Kicker>
        <T role="title">{level === 3 && groupKey ? groupKey : level === 2 ? "Pick a brand" : "What does your car need?"}</T>
        {level === 3 && groupKey ? <T role="caption" tone="secondary">{BRANDS.find((b) => b.name === groupKey)?.blurb ?? ""}</T> : null}
      </View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search washes, ceramic, PPF..."
        placeholderTextColor={colors.textTertiary}
        style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 15 }}
      />
    </View>
  );

  return (
    <Screen top={top}>
      {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {!services && !error ? (
        <View style={{ gap: space.line }}>
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : null}
      {services && searching ? (
        found.length === 0 ? <Notice title="Nothing matches" body="Try another word." /> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.line, justifyContent: "space-between" }}>{found.map(card)}</View>
      ) : null}
      {services && !searching && level === 1 ? (
        <View style={{ gap: space.breath }}>
          {cats.map((c) => tile(c, GROUP[c] ?? c, BLURB[c], fromPrice(all.filter((x) => x.category === c)) ?? undefined, ICON[c] ?? "tools", () => go({ cat: c })))}
        </View>
      ) : null}
      {services && !searching && level === 2 ? (
        <View style={{ gap: space.breath }}>
          {groups.map(([name, xs]) => tile(name, name, BRANDS.find((b) => b.name === name)?.blurb, [`${xs.length} ${xs.length === 1 ? "option" : "options"}`, fromPrice(xs)].filter(Boolean).join(" · "), ICON[cat ?? "other"] ?? "tools", () => go({ cat: cat!, brand: name })))}
        </View>
      ) : null}
      {services && !searching && level === 3 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.line, justifyContent: "space-between" }}>{products.map(card)}</View>
      ) : null}
    </Screen>
  );
}

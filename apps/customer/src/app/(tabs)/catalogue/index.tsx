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
const ORDER = ["washing", "ceramic", "coating", "ppf", "tinting", "inspection", "other"];
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

export default function CatalogueScreen() {
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const { need, cat } = useLocalSearchParams<{ need?: string; cat?: string }>();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<string>("all");
  const [q, setQ] = useState("");
  const brand: string | null = null;

  const load = useCallback(async () => {
    setError(false);
    try {
      setServices(await getServiceCatalogue());
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    const c = cat ?? (need ? NEED_TO_CAT[need] : undefined);
    if (c) setActive(c);
  }, [need, cat]);

  const all = services ?? [];
  const cats = ORDER.filter((c) => all.some((x) => x.category === c));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((x) => (active === "all" || x.category === active) && (!brand || x.brand === brand) && (!t || `${x.name} ${x.brand ?? ""}`.toLowerCase().includes(t)));
  }, [all, active, q, brand]);
  // One pattern for every category: brand (or sub-group) > product cards. Studio services carry a real
  // price; brand-catalogue products (sourced from the brand's site) say "ask the studio".
  type Entry = { svc?: Service; item?: BrandItem };
  const sections = useMemo(() => {
    const m = new Map<string, Entry[]>();
    const catOf = (k: BrandItem["kind"]) => (k === "PPF" ? "ppf" : "ceramic");
    const ranked = [...shown].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || Number(a.priceOnRequest === true) - Number(b.priceOnRequest === true) || a.basePrice - b.basePrice);
    const label = (cat: string, name: string) => (active === "all" ? `${GROUP[cat] ?? "More"} · ${name}` : name);
    for (const sv of ranked) {
      const inferred = BRANDS.find((b) => b.items.some((it) => sv.name.toLowerCase().includes(it.name.toLowerCase())))?.name;
      const k = label(sv.category, sv.brand ?? inferred ?? subGroup(sv));
      m.set(k, [...(m.get(k) ?? []), { svc: sv }]);
    }
    return [...m.entries()];
  }, [shown, active, q]);

  const chip = (key: string, label: string, icon: IconName) => {
    const on = active === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setActive(key)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingLeft: 8, paddingRight: 16, borderRadius: 23, backgroundColor: on ? colors.accent : colors.surface, borderWidth: 1, borderColor: on ? colors.accent : colors.borderSubtle, opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(255,255,255,0.28)" : colors.accentHaze }}>
          <Icon name={icon} color={on ? "#FFFFFF" : colors.accent} size={17} />
        </View>
        <T role="bodyStrong" style={{ color: on ? "#FFFFFF" : colors.textPrimary }}>{label}</T>
      </Pressable>
    );
  };

  const top = (
    <View style={{ gap: space.line }}>
      <View style={{ gap: space.hair }}>
        <Kicker tone="accent">Services</Kicker>
        <T role="title">What does your car need?</T>
      </View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search washes, ceramic, PPF..."
        placeholderTextColor={colors.textTertiary}
        style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 15 }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.breath }}>
        {chip("all", "All", "tools")}
        {cats.map((c) => chip(c, GROUP[c] ?? c, ICON[c] ?? "tools"))}
      </ScrollView>
    </View>
  );

  return (
    <Screen top={top}>
      {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {!services && !error ? (
        <View style={{ gap: space.line }}>
          <Skeleton height={18} width="40%" />
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : null}
      {services && sections.length === 0 ? <Notice title="Nothing matches" body="Try another word or pick All." /> : null}
      {sections.map(([title, xs]) => {
        const parts = title.split(" · ");
        const name = parts.pop() ?? title;
        const group = parts[0];
        const br = BRANDS.find((x) => x.name === name);
        const cat = xs[0]?.svc?.category;
        return (
          <View key={title} style={{ gap: space.breath }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.line }}>
              <View style={{ flex: 1, gap: 2 }}>
                {group ? <Kicker tone="accent">{group}</Kicker> : null}
                <T role="title" numberOfLines={1}>{name}</T>
                {br ? <T role="caption" tone="secondary" numberOfLines={2}>{br.blurb}</T> : null}
              </View>
              {active === "all" && cat ? (
                <Pressable accessibilityRole="button" onPress={() => setActive(cat)} hitSlop={8}>
                  <T role="caption" tone="accent">See all</T>
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.breath, paddingRight: space.line }}>
              {xs.map((e) => {
                const sv = e.svc!;
                return (
                  <Pressable key={sv.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} style={({ pressed }) => ({ width: 156, opacity: pressed ? 0.85 : 1 })}>
                    <View>
                      <ServicePhoto service={sv} height={196} radius={22} />
                      {sv.warrantyLabel ? (
                        <View style={{ position: "absolute", left: 8, bottom: 8, maxWidth: "88%", borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 10, paddingVertical: 4 }}>
                          <T role="caption" tone="accent" numberOfLines={1}>{sv.warrantyLabel}</T>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ paddingTop: 8, gap: 2 }}>
                      <T role="bodyStrong" numberOfLines={2}>{sv.name.replace(/^Kovalent\s+/i, "")}</T>
                      <T role="caption" tone="tertiary" numberOfLines={1}>{[duration(sv.estimatedDurationMinutes), sv.brand].filter(Boolean).join(" · ")}</T>
                      <T role="bodyStrong" tone="accent" numberOfLines={1}>{priceLabel(sv)}</T>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </Screen>
  );
}

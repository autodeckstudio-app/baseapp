// Services: one screen, two levels. Sticky category chips, sub-group sections, search, compact rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { BRANDS, type BrandItem } from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Service } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, priceLabel } from "../../../lib/catalogue-service";
import { serviceImagery } from "../../../lib/imagery";
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
      if (s.warrantyLabel) return `${s.warrantyLabel} protection`;
      return s.category === "ceramic" ? "Ceramic packages" : "Polish and coat";
    default:
      return GROUP[s.category] ?? "More";
  }
}

const ICON: Record<string, string> = { washing: "🫧", ceramic: "✨", coating: "🛡️", ppf: "🎞️", tinting: "🪟", inspection: "🔍", other: "🔧" };
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

  const chip = (key: string, label: string) => {
    const on = active === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setActive(key)}
        style={{ borderRadius: 9999, borderWidth: 1, borderColor: on ? colors.accent : colors.borderSubtle, backgroundColor: on ? colors.accentHaze : "transparent", paddingHorizontal: 14, paddingVertical: 8 }}
      >
        <T role="caption" tone={on ? "accent" : "secondary"}>{label}</T>
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
        {chip("all", "All")}
        {cats.map((c) => chip(c, GROUP[c] ?? c))}
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
      {services && active === "all" && !q.trim() ? (
        <View style={{ gap: space.inset }}>
          <View style={{ gap: space.breath }}>
            <Kicker>Browse by need</Kicker>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
              {cats.map((c) => {
                const xs = all.filter((x) => x.category === c);
                const low = Math.min(...xs.map((x) => x.basePrice));
                return (
                  <Pressable key={c} accessibilityRole="button" onPress={() => setActive(c)} style={({ pressed }) => ({ width: "48%", flexGrow: 1, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.accentHaze, padding: space.line, gap: 6, opacity: pressed ? 0.7 : 1 })}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
                      <T role="title">{ICON[c] ?? "🔧"}</T>
                    </View>
                    <T role="bodyStrong">{GROUP[c] ?? c}</T>
                    <T role="caption" tone="tertiary">{BLURB[c] ?? ""}</T>
                    <T role="caption" tone="accent">{`${xs.length} options · from ${rupees(low)}`}</T>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: space.breath }}>
            <Kicker tone="premium">Top picks</Kicker>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.breath }}>
              {cats.map((c) => {
                const xs = all.filter((x) => x.category === c).sort((a, b) => Number(!!b.warrantyLabel) - Number(!!a.warrantyLabel) || a.basePrice - b.basePrice);
                const sv = xs[0];
                if (!sv) return null;
                return (
                  <Pressable key={sv.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} style={({ pressed }) => ({ width: 220, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.borderSubtle, opacity: pressed ? 0.7 : 1 })}>
                    <Image source={serviceImagery[sv.category] ?? serviceImagery.other} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                    <View style={{ padding: space.line, gap: 4 }}>
                      <T role="bodyStrong" numberOfLines={1}>{sv.name}</T>
                      <T role="caption" tone="tertiary">{[duration(sv.estimatedDurationMinutes), sv.brand].filter(Boolean).join(" · ")}</T>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <T role="bodyStrong" tone="accent">{priceLabel(sv)}</T>
                        {sv.warrantyLabel ? <Chip label={sv.warrantyLabel} tone="premium" /> : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <Kicker>All services</Kicker>
        </View>
      ) : null}
      {sections.map(([title, xs]) => (
        <View key={title} style={{ gap: space.breath }}>
          <Kicker>{title}</Kicker>
          <Pane pad="gap">
            {xs.map((e, i) =>
              e.svc ? (
                <Pressable
                  key={e.svc.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/(tabs)/catalogue/${e.svc!.id}`)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.line, paddingVertical: space.breath, borderBottomWidth: i === xs.length - 1 ? 0 : 1, borderBottomColor: colors.borderSubtle, opacity: pressed ? 0.7 : 1 })}
                >
                  <Image source={serviceImagery[e.svc.category] ?? serviceImagery.other} style={{ width: 64, height: 64, borderRadius: 14 }} resizeMode="cover" />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T role="bodyStrong" numberOfLines={2}>{e.svc.name}</T>
                    <T role="caption" tone="tertiary">{[duration(e.svc.estimatedDurationMinutes), e.svc.brand].filter(Boolean).join(" · ")}</T>
                    {e.svc.warrantyLabel ? <View style={{ alignSelf: "flex-start" }}><Chip label={e.svc.warrantyLabel} tone="premium" /></View> : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <T role="caption" tone="tertiary">from</T>
                    <T role="bodyStrong" tone="accent">{priceLabel(e.svc)}</T>
                  </View>
                </Pressable>
              ) : (
                <Row
                  key={`${title}-${e.item!.name}`}
                  title={e.item!.name}
                  detail={e.item!.note ? <T role="caption" tone="tertiary">{e.item!.note}</T> : undefined}
                  trailing={e.item!.warranty ? <Chip label={e.item!.warranty.split(" (")[0] ?? e.item!.warranty} tone="premium" /> : <T role="caption" tone="tertiary">Ask the studio</T>}
                  onPress={() => router.push(`/(tabs)/catalogue/brands?b=${encodeURIComponent(title.split(" · ").pop() ?? "")}&n=${encodeURIComponent(e.item!.name)}`)}
                  last={i === xs.length - 1}
                />
              ),
            )}
          </Pane>
        </View>
      ))}
      <T role="caption" tone="tertiary">Brand products and warranty as stated on each brand's website. Draft, pending studio review.</T>
    </Screen>
  );
}

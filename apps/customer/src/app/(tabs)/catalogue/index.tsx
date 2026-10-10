import { usePricingVehicle } from "../../../lib/vehicle-size";
// Services: one screen, two levels. Sticky category chips, sub-group sections, search, compact rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ImageSourcePropType, Pressable, TextInput, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { BRANDS} from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Service } from "@autodeck/core";
import { space, type IconName } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, calculateServicePrice, priceLabel } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { serviceVisual, brandHero, serviceImagery } from "../../../lib/imagery";
import { Button, Kicker, Notice, Screen, Skeleton, T, rupees } from "../../../ui/kit";

const GROUP: Record<string, string> = {
  washing: "Wash and care",
  ceramic: "Ceramic",
  coating: "Coatings",
  ppf: "Paint film",
  tinting: "Window film",
  inspection: "Inspection",
  other: "Other",
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
  washing: "Safe hand washes, interior cleaning and finishing touches to keep your car fresh.",
  ceramic: "A hard, glossy layer that repels dirt and keeps paint looking new for years.",
  coating: "Budget-friendly shine and easier upkeep between full ceramic treatments.",
  ppf: "Clear film that takes the hit from stone chips, scratches and road wear.",
  tinting: "Heat rejection, privacy and UV protection for your windows.",
  inspection: "A careful check of paint and body so you know what needs attention first.",
  other: "Extras and one-off jobs that do not fit the other groups.",
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
  const pricingVehicle = usePricingVehicle();
  const [prices, setPrices] = useState<Record<string,number>>({});
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

  useEffect(() => {
    setPrices({});
    if (!services || !pricingVehicle.category) return;
    let active=true;
    void Promise.all(services.filter(s=>!s.priceOnRequest).map(async s=>{
      try { const {breakdown}=await calculateServicePrice(s.id,pricingVehicle.category!); return [s.id,breakdown.total] as const; }
      catch {return null;}
    })).then(rows=>{if(active)setPrices(Object.fromEntries(rows.filter(x=>x!==null)));});
    return ()=>{active=false;};
  },[services,pricingVehicle.category]);
  const all = services ?? [];
  const pricedLabel=(sv:Service)=>sv.priceOnRequest?"Quote on request":pricingVehicle.category?(prices[sv.id]!==undefined?rupees(prices[sv.id]!):"Checking price"):priceLabel(sv);
  const pricedFrom=(xs:Service[])=>{
    if(!pricingVehicle.category)return fromPrice(xs);
    const amounts=xs.filter(s=>!s.priceOnRequest).map(s=>prices[s.id]).filter((x):x is number=>x!==undefined);
    return amounts.length ? `From ${rupees(Math.min(...amounts))}` : "Checking prices";
  };
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

  const tile = (key: string, title: string, sub: string | undefined, meta: string | undefined, _icon: IconName, onPress: () => void, image?: ImageSourcePropType) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ width: "100%", height: 168, borderRadius: 28, overflow: "hidden", backgroundColor: "#121214", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      {image ? <FadeImage source={image} resizeMode="cover" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} /> : null}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(90deg, rgba(5,5,6,0.88) 0%, rgba(5,5,6,0.45) 60%, rgba(5,5,6,0.1) 100%)" } as object), backgroundColor: "rgba(5,5,6,0.3)" }} />
      <View style={{ flex: 1, justifyContent: "flex-end", padding: 18, gap: 4 }}>
        <T role="heading" numberOfLines={1} style={{ color: "#FFFFFF" }}>{title}</T>
        {sub ? <T role="caption" numberOfLines={2} style={{ color: "#D6D4D1" }}>{sub}</T> : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          {meta ? <View style={{ borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 3 }}><T role="caption" tone="accent" numberOfLines={1}>{meta}</T></View> : <View />}
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F59A45" }}><T style={{ color: "#1A1410" }}>›</T></View>
        </View>
      </View>
    </Pressable>
  );

  const card = (sv: Service) => (
    <Pressable key={sv.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} style={({ pressed }) => ({ width: "48%", minWidth: 0, overflow: "hidden", opacity: pressed ? 0.85 : 1 })}>
      <View>
        <ServicePhoto service={sv} height={200} radius={24} />
        {sv.warrantyLabel ? (
          <View style={{ position: "absolute", left: 8, bottom: 8, maxWidth: "88%", borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 4 }}>
            <T role="caption" tone="accent" numberOfLines={1}>{sv.warrantyLabel}</T>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 8, gap: 2 }}>
        <T role="bodyStrong" numberOfLines={2}>{sv.name.replace(/^Kovalent\s+/i, "")}</T>
        <T role="caption" tone="tertiary" numberOfLines={1}>{duration(sv.estimatedDurationMinutes)}</T>
        <T role="bodyStrong" tone="accent" numberOfLines={1}>{pricedLabel(sv)}</T>
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
        <T role="title">{level === 3 && groupKey ? groupKey : level === 2 ? "Explore your options" : "What does your car need?"}</T>
        {level === 3 && groupKey ? <T role="caption" tone="secondary">{BRANDS.find((b) => b.name === groupKey)?.blurb ?? ""}</T> : null}
      </View>
      {pricingVehicle.label ? <T role="caption" tone="accent">For your {pricingVehicle.vehicle?.make} {pricingVehicle.vehicle?.model} · {pricingVehicle.label} · incl. GST</T> : null}
      <TextInput
        accessibilityLabel="Search services"
        value={q}
        onChangeText={setQ}
        placeholder="Search washes, ceramic, PPF..."
        placeholderTextColor={colors.textTertiary}
        style={{ borderRadius: 9999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 18, paddingVertical: 12, color: colors.textPrimary, fontSize: 15 }}
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
        found.length === 0 ? <Notice title="Nothing matches" body="Try another word." /> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.line, justifyContent: "space-between", rowGap: 18 }}>{found.map(card)}</View>
      ) : null}
      {services && !searching && level === 1 ? (
        <View style={{ gap: space.breath }}>
          {cats.map((c) => tile(c, GROUP[c] ?? c, BLURB[c], pricedFrom(all.filter((x) => x.category === c)) ?? undefined, ICON[c] ?? "tools", () => go({ cat: c }), serviceImagery[c as keyof typeof serviceImagery]))}
        </View>
      ) : null}
      {services && !searching && level === 2 ? (
        <View style={{ gap: space.breath }}>
          {groups.map(([name, xs]) => tile(name, name, BRANDS.find((b) => b.name === name)?.blurb, [`${xs.length} ${xs.length === 1 ? "option" : "options"}`, pricedFrom(xs)].filter(Boolean).join(" · "), ICON[cat ?? "other"] ?? "tools", () => go({ cat: cat!, brand: name }), brandHero(name) ?? serviceVisual(xs[0] ?? {name,category:cat ?? "other"}).photo))}
        </View>
      ) : null}
      {services && !searching && level === 3 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.line, justifyContent: "space-between", rowGap: 18 }}>{products.map(card)}</View>
      ) : null}
    </Screen>
  );
}

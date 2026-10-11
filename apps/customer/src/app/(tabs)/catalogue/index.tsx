import type { ReactElement } from "react";
import { usePricingVehicle } from "../../../lib/vehicle-size";
// Services: one screen, two levels. Sticky category chips, sub-group sections, search, compact rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ImageSourcePropType, Pressable, Text, TextInput, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { BRANDS} from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Service } from "@autodeck/core";
import { layout, space, type IconName } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, calculateServicePrice, priceLabel } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { serviceVisual, brandHero, serviceImagery } from "../../../lib/imagery";
import { PhotoCard, GroupChips, groupCategories } from "../../../ui/HomeView";
import { Icon } from "@autodeck/ui/native";
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
  const [grp, setGrp] = useState<string | null>(null);
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
  const grpCats = groupCategories(grp);
  const cats = ORDER.filter((c) => all.some((x) => x.category === c) && (!grp || grpCats.includes(c)));
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

  const tile = (key: string, title: string, _sub: string | undefined, meta: string | undefined, _icon: IconName, onPress: () => void, image?: ImageSourcePropType) => (
    <PhotoCard key={key} title={title} pill={meta?.replace(/^From /, "From ")} hearted={false} onPress={onPress} media={image ? <FadeImage source={image} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : null} />
  );
  const pairs = <X,>(xs: X[]): X[][] => { const r: X[][] = []; for (let i = 0; i < xs.length; i += 2) r.push(xs.slice(i, i + 2)); return r; };
  const grid = (nodes: ReactElement[]) => (
    <View style={{ gap: 12 }}>
      {pairs(nodes).map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 12 }}>{r}{r.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>
      ))}
    </View>
  );

  const card = (sv: Service) => (
    <PhotoCard key={sv.id} title={sv.name.replace(/^Kovalent\s+/i, "")} pill={pricedLabel(sv) === "Quote on request" ? "Quote" : pricedLabel(sv)} onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} media={<ServicePhoto service={sv} height={400} />} />
  );

  const crumb = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom:layout.secondaryHeadingGap, minHeight:44, justifyContent:"center" }}>
      <T role="caption" tone="accent">‹ {label}</T>
    </Pressable>
  );

  const top = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        {level === 3 && groups.length > 1 && cat ? crumb(GROUP[cat] ?? "Services", () => go({ cat })) : level >= 2 && cat ? crumb("All services", () => router.push("/(tabs)/catalogue")) : null}
        <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "700" }}>{level === 3 && groupKey ? groupKey : cat ? (GROUP[cat] ?? "Services") : "Services"}</Text>
        {level === 3 && groupKey ? <T role="caption" tone="secondary">{BRANDS.find((b) => b.name === groupKey)?.blurb ?? ""}</T> : null}
      </View>
      {pricingVehicle.label ? <T role="caption" tone="accent">For your {pricingVehicle.vehicle?.make} {pricingVehicle.vehicle?.model} · {pricingVehicle.label} · incl. GST</T> : null}
      <View style={{ height: 48, borderRadius: 24, backgroundColor: "#26262A", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
        <Icon name="search" color="#8C8A86" size={20} />
        <TextInput
          accessibilityLabel="Search services"
          value={q}
          onChangeText={setQ}
          placeholder="Search services"
          placeholderTextColor="#8C8A86"
          style={{ flex: 1, color: "#FFFFFF", fontSize: 15, outlineStyle: "none" } as never}
        />
      </View>
      {!cat && !searching ? <GroupChips value={grp} onChange={setGrp} /> : null}
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
        found.length === 0 ? <Notice title="Nothing matches" body="Try another word." /> : grid(found.map(card))
      ) : null}
      {services && !searching && level === 1 ? (
        grid(cats.map((c) => tile(c, GROUP[c] ?? c, BLURB[c], pricedFrom(all.filter((x) => x.category === c)) ?? undefined, ICON[c] ?? "tools", () => go({ cat: c }), serviceImagery[c as keyof typeof serviceImagery])))
      ) : null}
      {services && !searching && level === 2 ? (
        grid(groups.map(([name, xs]) => tile(name, name, BRANDS.find((b) => b.name === name)?.blurb, [`${xs.length} ${xs.length === 1 ? "option" : "options"}`, pricedFrom(xs)].filter(Boolean).join(" · "), ICON[cat ?? "other"] ?? "tools", () => go({ cat: cat!, brand: name }), brandHero(name) ?? serviceVisual(xs[0] ?? {name,category:cat ?? "other"}).photo)))
      ) : null}
      {services && !searching && level === 3 ? (
        grid(products.map(card))
      ) : null}
    </Screen>
  );
}

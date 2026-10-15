import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import type { ReactElement } from "react";
import { usePricingVehicle, useVehiclePrices, servicePriceText } from "../../../lib/vehicle-size";
// Services: one screen, two levels. Sticky category chips, sub-group sections, search, compact rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ImageSourcePropType, Pressable, Text, TextInput, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { BRANDS} from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COATING_BRANDS, PPF_BRANDS, MENU_GROUPS, COVERAGE_LEVELS, PAINT_INSPECTION_NOTE, menuGroupOf, needsInspectionNote, garageSectionOf, GARAGE_SECTIONS, type MenuGroup, type Service } from "@autodeck/core";
import { layout, space, type IconName } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { serviceVisual, brandHero, serviceImagery } from "../../../lib/imagery";
import { PhotoCard, GroupChips, groupCategories } from "../../../ui/HomeView";
import { Icon } from "@autodeck/ui/native";
import { Button, Kicker, Notice, Screen, Skeleton, T, rupees } from "../../../ui/kit";

// Old "?need=" deep links map onto a menu group.
const NEED_TO_GROUP: Record<string, string> = { wash: "wash", shine: "coatings", ceramic: "coatings", ppf: "ppf", tint: "mods", check: "garage" };
const GROUP_IMAGE: Record<string, keyof typeof serviceImagery> = { wash: "washing", coatings: "ceramic", ppf: "ppf", garage: "inspection", mods: "tinting", pickup: "other" };

function fromPrice(xs: Service[]): string | null {
  const a = xs.filter((s) => !s.priceOnRequest).map((s) => s.basePrice);
  return a.length ? `From ${rupees(Math.min(...a))}` : xs.length ? "Consult" : null;
}

function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 8 ? `${Math.round(h / 8)} day${h >= 16 ? "s" : ""}` : `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}

export default function CatalogueScreen() {
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const { need, cat: catParam, brand: brandParam } = useLocalSearchParams<{ need?: string; cat?: string; brand?: string }>();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState(false);
  const pricingVehicle = usePricingVehicle();
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState<string | null>(null);
  const fromRoute = catParam ?? (need ? NEED_TO_GROUP[need] : undefined);
  // A chip opens that group's brands or products directly, never a card for the group you just picked.
  const cat = fromRoute ?? grp ?? undefined; // a menu group key
  const catGroup = MENU_GROUPS.find((g) => g.key === cat);
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
  const prices = useVehiclePrices(all, pricingVehicle.category);
  const pricedLabel=(sv:Service)=>servicePriceText(sv,pricingVehicle.category,prices);
  const pricedFrom=(xs:Service[])=>{
    if(!pricingVehicle.category)return fromPrice(xs);
    const amounts=xs.filter(s=>!s.priceOnRequest).map(s=>prices[s.id]).filter((x):x is number=>x!==undefined);
    return amounts.length ? `From ${rupees(Math.min(...amounts))}` : undefined;
  };
  const byPrice = (a: Service, b: Service) => Number(a.priceOnRequest === true) - Number(b.priceOnRequest === true) || a.basePrice - b.basePrice;
  const inGroup = (g: MenuGroup) => all.filter((x) => (g.categories as string[]).includes(x.category));
  const visibleGroups = MENU_GROUPS.filter((g) => inGroup(g).length > 0 && (!grp || g.key === grp));
  // Level 2: brands for coatings and PPF, otherwise a flat list. Items without a brand go under "More".
  const groups = useMemo(() => {
    if (!catGroup) return [] as [string, Service[]][];
    const xs = all.filter((x) => (catGroup.categories as string[]).includes(x.category));
    if (catGroup.key === "garage") {
      const gm = new Map<string, Service[]>();
      for (const sv of xs) { const k = garageSectionOf(sv.id); gm.set(k, [...(gm.get(k) ?? []), sv]); }
      return GARAGE_SECTIONS.filter((k) => gm.has(k)).map((k) => [k, [...(gm.get(k) ?? [])].sort(byPrice)] as [string, Service[]]);
    }
    if (!catGroup.byBrand) return [[catGroup.label, [...xs].sort(byPrice)]] as [string, Service[]][];
    const order: string[] = catGroup.key === "ppf" ? [...PPF_BRANDS] : [...COATING_BRANDS];
    const m = new Map<string, Service[]>();
    for (const sv of xs) { const k = sv.brand?.trim() || "More"; m.set(k, [...(m.get(k) ?? []), sv]); }
    const rank = (k: string) => { const i = order.indexOf(k); return i < 0 ? 99 : i; };
    return [...m.entries()].map(([k, v]) => [k, [...v].sort(byPrice)] as [string, Service[]]).sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [all, cat]);

  const go = (params: Record<string, string>) => router.push({ pathname: "/(tabs)/catalogue", params });
  const t = q.trim().toLowerCase();
  const searching = t.length > 0;
  const found = searching ? all.filter((x) => `${x.name} ${x.brand ?? ""}`.toLowerCase().includes(t)).sort(byPrice) : [];
  // Skip a pointless level: one group means go straight to its products.
  const level: 1 | 2 | 3 = !catGroup ? 1 : brand || groups.length === 1 ? 3 : 2;
  const groupKey = brand ?? groups[0]?.[0];
  const products = level === 3 ? (groups.find(([k]) => k === groupKey)?.[1] ?? []) : [];

  // A category with exactly one service has nothing to choose from: open it directly.
  const soleId = !searching && !!fromRoute && level === 3 && !brand && products.length === 1 ? products[0]?.id : undefined;
  useEffect(() => { if (soleId) router.replace(`/(tabs)/catalogue/${soleId}`); }, [soleId, router]);

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

  const card = (sv: Service, i = 0) => (
    <PhotoCard key={sv.id} title={sv.name.replace(/^Kovalent\s+/i, "")} pill={pricedLabel(sv) === "Quote on request" ? "Consult" : pricedLabel(sv) ?? undefined} onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} media={<ServicePhoto service={sv} height={400} variant={i} />} />
  );

  const crumb = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom:layout.secondaryHeadingGap, minHeight:44, justifyContent:"center" }}>
      <T role="caption" tone="accent">‹ {label}</T>
    </Pressable>
  );

  const top = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        {!fromRoute ? null : level === 3 && groups.length > 1 && cat ? crumb(catGroup?.label ?? "Services", () => go({ cat })) : level >= 2 && cat ? crumb("All services", () => router.push("/(tabs)/catalogue")) : null}
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "700", lineHeight: 32 }}>{level === 3 && groupKey ? groupKey : catGroup ? catGroup.label : "What does your car need?"}</Text>
        {level === 3 && groupKey ? <T role="caption" tone="secondary">{BRANDS.find((b) => b.name === groupKey)?.blurb ?? ""}</T> : null}
      </View>
      {pricingVehicle.label ? <T role="caption" tone="accent">For your {pricingVehicle.vehicle?.make} {pricingVehicle.vehicle?.model} · {pricingVehicle.label} · incl. GST</T> : null}
      <View style={{ height: 48, borderRadius: 24, ...glassInner, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
        <Icon name="search" color={colors.textTertiary} size={20} />
        <TextInput
          accessibilityLabel="Search services"
          value={q}
          onChangeText={setQ}
          placeholder="Search services"
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 15, outlineStyle: "none" } as never}
        />
      </View>
      {!fromRoute && !searching ? <GroupChips value={grp} onChange={setGrp} /> : null}
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
        grid(visibleGroups.map((g) => tile(g.key, g.label, g.blurb, g.pricing === "consult" ? "Consult" : pricedFrom(inGroup(g)) ?? undefined, "tools", () => go({ cat: g.key }), serviceImagery[GROUP_IMAGE[g.key] ?? "other"])))
      ) : null}
      {services && !searching && level === 2 ? (
        <View style={{ gap: 22 }}>
          {groups.map(([name, xs]) => (
            <View key={name} style={{ gap: 10 }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{name}</Text>
                {BRANDS.find((b) => b.name === name)?.blurb ? <T role="caption" tone="secondary">{BRANDS.find((b) => b.name === name)?.blurb}</T> : null}
              </View>
              {grid(xs.map(card))}
            </View>
          ))}
        </View>
      ) : null}
      {services && !searching && level >= 2 && cat && (cat === "ppf" || cat === "coatings") ? <T role="caption" tone="secondary">{PAINT_INSPECTION_NOTE}</T> : null}
      {services && !searching && level === 3 ? (
        cat === "ppf" ? (
          <View style={{ gap: 18 }}>
            {[...COVERAGE_LEVELS.map((c) => ({ key: c.key as string, label: c.label, blurb: c.blurb })), { key: "none", label: "Other films", blurb: "" }]
              .map((lv) => ({ lv, xs: products.filter((x) => (x.coverageLevel ?? "none") === lv.key) }))
              .filter((r) => r.xs.length > 0)
              .map(({ lv, xs }) => (
                <View key={lv.key} style={{ gap: 10 }}>
                  <View style={{ gap: 2 }}>
                    <Text style={{ color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{lv.label}</Text>
                    {lv.blurb ? <T role="caption" tone="secondary">{lv.blurb}</T> : null}
                  </View>
                  {grid(xs.map(card))}
                </View>
              ))}
          </View>
        ) : grid(products.map(card))
      ) : null}
    </Screen>
  );
}

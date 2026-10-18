import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import type { ReactElement } from "react";
import { usePricingVehicle, useVehiclePrices, servicePriceText } from "../../../lib/vehicle-size";
// Services: one screen, two levels. Sticky category chips, sub-group sections, search, rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ImageSourcePropType, Pressable, Text, TextInput, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { BRANDS} from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import { COATING_BRANDS, PPF_BRANDS, MENU_GROUPS, COVERAGE_LEVELS, PAINT_INSPECTION_NOTE, GST_ENABLED, menuGroupOf, PICKUP_TILE_TEXT, needsInspectionNote, garageSectionOf, GARAGE_SECTIONS, type MenuGroup, type Service } from "@autodeck/core";
import { layout, space, type IconName } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, peekCatalogue } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { serviceVisual, brandHero, serviceImagery } from "../../../lib/imagery";
import { PhotoCard, GroupChips, groupCategories, TILE_GAP } from "../../../ui/HomeView";
import { Icon } from "@autodeck/ui/native";
import { Button, Kicker, Notice, Pane, Row, Screen, Skeleton, T, rupees } from "../../../ui/kit";
import { buildTree, leafServices, pathToLabel, resolvePath, type TreeNode } from "../../../lib/services-tree";

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
  const { need, cat: catParam, brand: brandParam, p: pathParam } = useLocalSearchParams<{ need?: string; cat?: string; brand?: string; p?: string }>();
  const [services, setServices] = useState<Service[] | null>(() => peekCatalogue());
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
  const tree = useMemo(() => (catGroup ? buildTree(catGroup, all) : []), [all, cat]);
  const pathKeys = useMemo(() => {
    const fromParam = (pathParam ?? "").split(",").filter(Boolean);
    if (fromParam.length) return fromParam;
    return brand ? pathToLabel(tree, brand) ?? [] : [];
  }, [pathParam, brand, tree]);
  const { nodes, trail } = useMemo(() => resolvePath(tree, pathKeys), [tree, pathKeys]);

  const go = (params: Record<string, string>) => router.push({ pathname: "/(tabs)/catalogue", params });
  const t = q.trim().toLowerCase();
  const searching = t.length > 0;
  const found = searching ? all.filter((x) => `${x.name} ${x.brand ?? ""}`.toLowerCase().includes(t)).sort(byPrice) : [];
  const level: 1 | 2 = !catGroup ? 1 : 2;
  const soleLeaf = nodes.length === 1 && nodes[0]!.kind === "leaf" ? nodes[0]!.service.id : undefined;
  // A category with exactly one service has nothing to choose from: open it directly.
  const soleId = !searching && !!fromRoute && catGroup && !!soleLeaf ? soleLeaf : undefined;
  useEffect(() => { if (soleId) router.replace(`/(tabs)/catalogue/${soleId}`); }, [soleId, router]);

  const tile = (key: string, title: string, _sub: string | undefined, meta: string | undefined, _icon: IconName, onPress: () => void, image?: ImageSourcePropType) => (
    <PhotoCard key={key} title={title} pill={meta?.replace(/^From /, "From ")} hearted={false} onPress={onPress} media={image ? <FadeImage source={image} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : null} />
  );
  const pairs = <X,>(xs: X[]): X[][] => { const r: X[][] = []; for (let i = 0; i < xs.length; i += 2) r.push(xs.slice(i, i + 2)); return r; };
  const grid = (nodes: ReactElement[]) => (
    <View style={{ gap: TILE_GAP }}>
      {pairs(nodes).map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: TILE_GAP }}>{r}{r.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>
      ))}
    </View>
  );

  const card = (sv: Service, i = 0) => (
    <PhotoCard key={sv.id} title={sv.name.replace(/^Kovalent\s+/i, "")} pill={pricedLabel(sv) === "Quote on request" ? "Consult" : pricedLabel(sv) ?? undefined} onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} media={<ServicePhoto service={sv} height={400} variant={i} />} />
  );


  // One list language at every level: glass rows, title left, a short facts line, price or chevron right.
  const rowFor = (n: TreeNode, last: boolean) => {
    if (n.kind === "branch") {
      const xs = leafServices(n);
      const from = pricedFrom(xs);
      return <Row key={n.key} last={last} title={n.label} detail={<T role="caption" tone="secondary">{[`${xs.length} ${xs.length === 1 ? "option" : "options"}`, from].filter(Boolean).join("  \u00b7  ")}</T>} trailing={<T role="heading" tone="tertiary">{"\u203A"}</T>} onPress={() => go({ cat: cat!, p: [...trail.map((t) => t.key), n.key].join(",") })} />;
    }
    const sv = n.service;
    const price = pricedLabel(sv);
    return <Row key={sv.id} last={last} title={sv.name.replace(/^Kovalent\s+/i, "")} detail={<T role="caption" tone="secondary">{[duration(sv.estimatedDurationMinutes), sv.warrantyLabel ?? null].filter(Boolean).join("  \u00b7  ")}</T>} trailing={<T role="bodyStrong">{price === "Quote on request" || !price ? "Consult" : price}</T>} onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} />;
  };
  const renderNodes = (ns: TreeNode[]) => {
    const sectionOf = (n: TreeNode) => (n.kind === "leaf" ? n.section ?? COVERAGE_LEVELS.find((c) => c.key === n.service.coverageLevel)?.label ?? "" : "");
    const order: string[] = [];
    for (const n of ns) { const k = sectionOf(n); if (!order.includes(k)) order.push(k); }
    return order.map((k) => {
      const xs = ns.filter((n) => sectionOf(n) === k);
      return (
        <View key={k || "all"} style={{ gap: 8 }}>
          {k ? <Text style={{ color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{k}</Text> : null}
          <Pane pad="gap">{xs.map((n, i) => rowFor(n, i === xs.length - 1))}</Pane>
        </View>
      );
    });
  };

  // Back climbs one real level. A level that was opened automatically is skipped so Back never lands on it again.
  const levelBack = !fromRoute || !cat ? undefined : () => {
    let up = trail.map((t) => t.key).slice(0, -1);
    while (up.length > 0 && resolvePath(tree, up).trail.length >= trail.length) up = up.slice(0, -1);
    if (up.length === 0 && resolvePath(tree, []).trail.length >= trail.length && trail.length > 0) { router.push("/(tabs)/catalogue"); return; }
    if (trail.length === 0) { router.push("/(tabs)/catalogue"); return; }
    go(up.length ? { cat, p: up.join(",") } : { cat });
  };
  const here = trail[trail.length - 1];
  const top = (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: "700", lineHeight: 32 }}>{here ? here.label : catGroup ? catGroup.label : "What does your car need?"}</Text>
        {catGroup && trail.length > 0 ? <T role="caption" tone="tertiary">{[catGroup.label, ...trail.slice(0, -1).map((t) => t.label)].join("  /  ")}</T> : null}
        {here ? <T role="caption" tone="secondary">{BRANDS.find((b) => b.name === here.label)?.blurb ?? ""}</T> : !trail.length && catGroup ? <T role="caption" tone="secondary">{catGroup.blurb}</T> : null}
      </View>
      {pricingVehicle.label ? <T role="caption" tone="accent">For your {pricingVehicle.vehicle?.make} {pricingVehicle.vehicle?.model} · {pricingVehicle.label}{GST_ENABLED ? " · incl. GST" : ""}</T> : null}
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
    <Screen appBar="Services" top={top} onBack={levelBack}>
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
        grid(visibleGroups.map((g) => tile(g.key, g.label, g.blurb, g.pricing === "consult" ? "Consult" : g.key === "pickup" ? PICKUP_TILE_TEXT : pricedFrom(inGroup(g)) ?? undefined, "tools", () => go({ cat: g.key }), serviceImagery[GROUP_IMAGE[g.key] ?? "other"])))
      ) : null}
      {services && !searching && level === 2 ? (
        <View style={{ gap: 18 }}>
          {renderNodes(nodes)}
          {cat === "ppf" || cat === "coatings" ? <T role="caption" tone="secondary">{PAINT_INSPECTION_NOTE}</T> : null}
        </View>
      ) : null}
    </Screen>
  );
}

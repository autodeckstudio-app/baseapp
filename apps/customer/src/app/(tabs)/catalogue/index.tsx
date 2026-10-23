import { formatDurationWithDays } from "../../../lib/duration";
import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import type { ReactElement } from "react";
import { usePricingVehicle, useVehiclePrices, servicePriceText } from "../../../lib/vehicle-size";
// Services: one screen, two levels. Sticky category chips, sub-group sections, search, rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ImageSourcePropType, Pressable, Text, TextInput, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { BRANDS} from "../../../lib/brands";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GROUP_PHOTO_CATEGORY, overviewGroups } from "../../../lib/catalogue-overview";
import { COATING_BRANDS, PPF_BRANDS, MENU_GROUPS, COVERAGE_LEVELS, PAINT_INSPECTION_NOTE, GST_ENABLED, menuGroupOf, PICKUP_TILE_TEXT, needsInspectionNote, garageSectionOf, GARAGE_SECTIONS, type MenuGroup, type Service } from "@autodeck/core";
import { layout, space, type IconName } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, peekCatalogue } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { serviceVisual, brandHero, typePhoto, serviceImagery } from "../../../lib/imagery";
import { PhotoCard, TILE_GAP } from "../../../ui/HomeView";
import { Icon } from "@autodeck/ui/native";
import { FilterPills } from "../../../ui/FilterPills";
import { Button, Kicker, Notice, Pane, Row, Screen, Skeleton, T, rupees } from "../../../ui/kit";
import { AREA_SECTIONS, areaSections, SERVICE_TYPES, buildTree, leafServices, matchesQuery, pathToLabel, resolvePath, type TreeNode } from "../../../lib/services-tree";

// Old "?need=" deep links map onto a menu group.
const NEED_TO_GROUP: Record<string, string> = { wash: "wash", shine: "coatings", ceramic: "coatings", ppf: "ppf", tint: "mods", check: "garage" };
const GROUP_IMAGE: Record<string, keyof typeof serviceImagery> = { wash: "washing", coatings: "ceramic", ppf: "ppf", garage: "inspection", mods: "tinting", pickup: "other" };

function fromPrice(xs: Service[]): string | null {
  const a = xs.filter((s) => !s.priceOnRequest).map((s) => s.basePrice);
  return a.length ? `From ${rupees(Math.min(...a))}` : xs.length ? "Consult" : null;
}

const duration = formatDurationWithDays;

const groupPhoto = (key: string): ImageSourcePropType | null => { const c = GROUP_PHOTO_CATEGORY[key]; return c ? serviceImagery[c] : null; };
const groupLabel = (g: MenuGroup): string => (g.key === "mods" ? "Modifications" : g.label);

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
  const cat = fromRoute ?? undefined; // a menu group key; the filter pills (grp) only narrow level 1
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
  const found = searching ? all.filter((x) => matchesQuery(x, t)).sort(byPrice) : [];
  const level: 1 | 2 = !catGroup ? 1 : 2;
  const soleLeaf = nodes.length === 1 && nodes[0]!.kind === "leaf" ? nodes[0]!.service.id : undefined;
  // A category with exactly one service has nothing to choose from: open it directly.
  const soleId = !searching && !!fromRoute && catGroup && !!soleLeaf ? soleLeaf : undefined;
  useEffect(() => { if (soleId) router.replace(`/(tabs)/catalogue/${soleId}`); }, [soleId, router]);

  const tile = (key: string, title: string, _sub: string | undefined, meta: string | undefined, _icon: IconName, onPress: () => void, image?: ImageSourcePropType) => (
    <PhotoCard key={key} title={title} pill={meta?.replace(/^From /, "From ")} hearted={false} onPress={onPress} media={image ? <FadeImage source={image} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : null} />
  );
  const pairs = <X,>(xs: X[]): X[][] => { const r: X[][] = []; for (let i = 0; i < xs.length; i += 2) r.push(xs.slice(i, i + 2)); return r; };
  const grid = (cells: ReactElement[]) => (
    <View style={{ gap: TILE_GAP }}>
      {pairs(cells).map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: TILE_GAP }}>{r}{r.length === 1 ? <View style={{ flex: 1 }} /> : null}</View>
      ))}
    </View>
  );

  const card = (sv: Service, i = 0) => (
    <PhotoCard key={sv.id} title={sv.name.replace(/^Kovalent\s+/i, "")} pill={pricedLabel(sv) === "Quote on request" ? "Consult" : pricedLabel(sv) ?? undefined} onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)} media={<ServicePhoto service={sv} height={400} variant={i} />} />
  );


  // One tile size at every level: photo, title, small price pill. Types and brands drill down, services open their page.
  const iconPanel = (icon: IconName) => (
    <View style={{ width: "100%", height: "100%", backgroundColor: "#15171B", alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: "60%", aspectRatio: 1, borderRadius: 9999, backgroundColor: "rgba(236,134,56,0.16)" }} />
      <Icon name={icon} color="#F4F1EC" size={40} />
    </View>
  );
  const nodeTile = (n: TreeNode, i: number, inCat?: string) => {
    const catKey = inCat ?? cat;
    const base = inCat ? [] : trail.map((step) => step.key);
    if (n.kind === "leaf") return card(n.service, i);
    if (n.kind === "enquiry") {
      const photo = typePhoto(n.key);
      return <PhotoCard key={n.key} title={n.label} pill="Get a quote" hearted={false} onPress={() => router.push("/(tabs)/help")} media={photo ? <FadeImage source={photo} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : iconPanel("tools")} />;
    }
    const xs = leafServices(n);
    const photo = base.length === 0 ? typePhoto(n.key) : null;
    const first = xs[0];
    const media = base.length === 0 && n.kind === "branch" && SERVICE_TYPES[catKey ?? ""] ? (photo ? <FadeImage source={photo} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : iconPanel("tools")) : first ? <ServicePhoto service={first} height={400} variant={i} /> : iconPanel("tools");
    return <PhotoCard key={n.key} title={n.label} pill={pricedFrom(xs)?.replace(/^From /, "From ")} hearted={false} onPress={() => go({ cat: catKey!, p: [...base, n.key].join(",") })} media={media} />;
  };
  const renderNodes = (ns: TreeNode[]) => {
    if (trail.length === 0 && catGroup && AREA_SECTIONS[catGroup.key]) {
      return areaSections(catGroup.key, ns).map((sec) => (
        <View key={sec.label || "all"} style={{ gap: 8 }}>
          {sec.label ? <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "700" }}>{sec.label}</Text> : null}
          {grid(sec.nodes.map((n, i) => nodeTile(n, i)))}
        </View>
      ));
    }
    const sectionOf = (n: TreeNode) => (n.kind === "leaf" ? COVERAGE_LEVELS.find((c) => c.key === n.service.coverageLevel)?.label ?? "" : "");
    const order: string[] = [];
    for (const n of ns) { const k = sectionOf(n); if (!order.includes(k)) order.push(k); }
    return order.map((k) => (
      <View key={k || "all"} style={{ gap: 8 }}>
        {k ? <Text style={{ color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{k}</Text> : null}
        {grid(ns.filter((n) => sectionOf(n) === k).map((n, i) => nodeTile(n, i)))}
      </View>
    ));
  };

  // Back climbs one real level. A level that was opened automatically is skipped so Back never lands on it again.
  const levelBack = !fromRoute || !cat ? undefined : () => {
    let up = trail.map((step) => step.key).slice(0, -1);
    while (up.length > 0 && resolvePath(tree, up).trail.length >= trail.length) up = up.slice(0, -1);
    if (up.length === 0 && resolvePath(tree, []).trail.length >= trail.length && trail.length > 0) { router.push("/(tabs)/catalogue"); return; }
    if (trail.length === 0) { router.push("/(tabs)/catalogue"); return; }
    go(up.length ? { cat, p: up.join(",") } : { cat });
  };
  const here = trail[trail.length - 1];
  const top = (
    <View style={{ gap: 16 }}>
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
      {!fromRoute && !searching ? <FilterPills items={[{ key: null as string | null, label: "All" }, ...MENU_GROUPS.filter((g) => inGroup(g).length > 0).map((g) => ({ key: g.key as string | null, label: groupLabel(g) }))]} value={grp} onChange={setGrp} /> : null}
    </View>
  );

  return (
    <Screen appBar={here?.label ?? catGroup?.label ?? "Services"} top={top} onBack={levelBack}>
      {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {!services && !error ? (
        <View style={{ gap: space.line }}>
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : null}
      {services && searching ? (
        found.length === 0 ? <Notice title="Nothing matches" body="Try another word." /> : grid(found.map(card))
      ) : null}
      {services && !searching && level === 1 && !grp ? (
        // All: one card per category, same as the filter pills. Tapping one opens that filter view.
        <View style={{ gap: 8 }} testID="category-cards">
          {grid(overviewGroups(MENU_GROUPS, (g) => inGroup(g).length).map((g) => {
            const photo = groupPhoto(g.key);
            const pill = pricedFrom(inGroup(g)) ?? (g.pricing === "consult" ? "Get a quote" : undefined);
            return <PhotoCard key={g.key} title={groupLabel(g)} pill={pill} hearted={false} onPress={() => { setGrp(g.key); }}
              media={photo ? <FadeImage source={photo} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : iconPanel("tools")} />;
          }))}
        </View>
      ) : null}
      {services && !searching && level === 1 && grp ? (
        <View style={{ gap: 18 }}>
          {visibleGroups.filter((g) => !grp || g.key === grp).map((g) => (
            <View key={g.key} style={{ gap: 8 }}>
              <Text style={{ color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>{groupLabel(g)}</Text>
              {areaSections(g.key, buildTree(g, all)).map((sec) => (
                <View key={sec.label || "all"} style={{ gap: 8 }}>
                  {sec.label ? <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "700" }}>{sec.label}</Text> : null}
                  {grid(sec.nodes.map((n, i) => nodeTile(n, i, g.key)))}
                </View>
              ))}
            </View>
          ))}
        </View>
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

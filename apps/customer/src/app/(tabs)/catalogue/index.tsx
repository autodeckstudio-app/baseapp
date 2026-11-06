import{ServicePackageCard}from '../../../ui/ServicePackageCard';
import{ServiceHomes}from "../../../ui/ServiceHomes";
import {hasCataloguePhoto} from "../../../lib/catalogue-assets";
import {PpfSelection} from '../../../ui/PpfSelection';
import {careEntryPrice} from "../../../lib/service-journey";
import {BRAND_ENQUIRIES} from "../../../lib/brand-enquiries";
import {CareJourney} from "../../../ui/CareJourney";
import { formatDurationWithDays } from "../../../lib/duration";
import { glassSurface, glassInner, glassOrange } from "../../../lib/glass";
import type { ReactElement } from "react";
import { usePricingVehicle, useVehiclePrices, servicePriceText } from "../../../lib/vehicle-size";
// Services: one screen, two levels. Sticky category chips, sub-group sections, search, rows.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ImageSourcePropType, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { BRANDS} from "../../../lib/brands";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { GROUP_PHOTO_CATEGORY, overviewGroups } from "../../../lib/catalogue-overview";
import { soleServiceRedirect } from "../../../lib/catalogue-sole-redirect";
import { COATING_BRANDS, PPF_BRANDS, MENU_GROUPS, COVERAGE_LEVELS, PAINT_INSPECTION_NOTE, GST_ENABLED, menuGroupOf, PICKUP_TILE_TEXT, needsInspectionNote, garageSectionOf, GARAGE_SECTIONS, type MenuGroup, type Service } from "@autodeck/core";
import { layout, space, type IconName } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue, peekCatalogue } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { BRAND_LOGOS, serviceVisual, brandHero, typePhoto, serviceImagery } from "../../../lib/imagery";
import { PhotoCard, TILE_GAP } from "../../../ui/HomeView";
import { Icon } from "@autodeck/ui/native";
import { useSegmentSwipe } from "../../../lib/segment-swipe";
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
  const [showEnquiries,setShowEnquiries]=useState(false);const [careActive,setCareActive]=useState(false);
  const pricingVehicle = usePricingVehicle();
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState<string | null>(null);
  // This screen stays mounted underneath pushed pages; only auto-redirect while it is the focused screen.
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
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

  const { height: winH } = useWindowDimensions();
  const filterKeys = ["all", ...MENU_GROUPS.filter(g => (services ?? []).some(s => (g.categories as string[]).includes(s.category))).map(g => g.key)];
  const grpRef = useRef(grp);
  grpRef.current = grp;
  const swipe = useSegmentSwipe(filterKeys, () => grpRef.current ?? "all", key => setGrp(key === "all" ? null : key));

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
  const soleId = soleServiceRedirect({ focused, searching, fromRoute, catGroup: catGroup?.key, soleLeaf });
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

  const card = (sv: Service, _i = 0) => <ServicePackageCard key={sv.id} service={sv} price={pricedLabel(sv)} onPress={() => router.push(`/(tabs)/catalogue/${sv.id}`)}/>;


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
      const photo = n.infoKey ? null : typePhoto(n.key);
      const exactProduct=n.infoKey?BRAND_ENQUIRIES.find(x=>x.key===n.infoKey):null;
      const exactVisual=exactProduct?serviceVisual({name:exactProduct.name,brand:exactProduct.brand,category:exactProduct.group==='ppf'?'ppf':'ceramic'}):null;
      const title = n.infoKey && trail.some(x=>x.key==="3M") ? n.label.replace("Scotchgard Paint Protection Film Pro ", "Scotchgard Pro ").replace("Paint Protection Film ", "") : n.label;
      return <PhotoCard key={n.key} title={title} pill={n.infoKey ? "Ask for a quote" : "Get a quote"} hearted={false} onPress={() => router.push(n.infoKey ? { pathname: "/(tabs)/catalogue/enquiry", params: { id: n.infoKey } } : { pathname: "/(tabs)/help", params: { service: n.label } })} media={exactProduct&&(hasCataloguePhoto({id:'enquiry:'+exactProduct.key})||exactVisual?.bottle)?<ServicePhoto service={{id:'enquiry:'+exactProduct.key,name:exactProduct.name,brand:exactProduct.brand,category:exactProduct.group==='ppf'?'ppf':'ceramic'}} height={400}/>:photo ? <FadeImage source={photo} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : iconPanel("tools")} />;
    }
    const xs = leafServices(n);
    const photo = base.length === 0 ? typePhoto(n.key) : null;
    const first = xs[0];
    const logo = BRAND_LOGOS[n.label];
    const media = logo ? <View style={{ width: "100%", height: "100%", backgroundColor: logo.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingTop: 44, paddingBottom: 40 }}><FadeImage source={logo.src} resizeMode="contain" style={{ width: "100%", height: "100%", maxHeight: 82 }} /></View> : base.length === 0 && n.kind === "branch" && SERVICE_TYPES[catKey ?? ""] ? (photo ? <FadeImage source={photo} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : iconPanel("tools")) : first ? <ServicePhoto service={first} height={400} variant={i} /> : iconPanel("tools");
    return <PhotoCard key={n.key} mediaTreatment={logo ? (logo.background === "#FFFFFF" ? "paper" : "logo-dark") : undefined} title={n.label} pill={xs.length ? pricedFrom(xs)?.replace(/^From /, "From ") : "Ask for a quote"} hearted={false} onPress={() => go({ cat: catKey!, p: [...base, n.key].join(",") })} media={media} />;
  };
  const renderNodes = (ns: TreeNode[]) => {
    const bookable=ns.filter(n=>leafServices(n).length>0);const enquiry=ns.filter(n=>leafServices(n).length===0);
    if(trail.length===0&&catGroup){return <View style={{gap:16}}>{bookable.map(n=><Row key={n.kind==='leaf'?n.service.id:n.key} title={n.kind==='leaf'?n.service.name:n.label} detail={`${leafServices(n).length} listed options`} onPress={()=>{if(n.kind==='leaf')router.push(`/(tabs)/catalogue/${n.service.id}`);else go({cat:catGroup.key,p:n.key});}} last/>)}{enquiry.length?<View style={{gap:10}}><Pressable accessibilityRole="button" onPress={()=>setShowEnquiries(x=>!x)}><T tone="secondary">{showEnquiries?'Hide':'Ask about'} other options ({enquiry.length})</T></Pressable>{showEnquiries?enquiry.map(n=>nodeTile(n,0)):null}</View>:null}</View>;}

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
        {<View style={{gap:12}}>{ns.filter((n) => sectionOf(n) === k).map((n, i) => nodeTile(n, i))}</View>}
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
    <View style={{ gap: 16, paddingBottom: 16 }} testID="services-filter-header">
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
      <View testID="services-swipe-area" {...(!fromRoute && !searching ? swipe.handlers : {})} style={[{ gap: 20, minHeight: Math.max(winH - 300, 480) }, !fromRoute && !searching ? swipe.style : null]}>
      {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {!services && !error ? (
        <View style={{ gap: space.line }}>
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : null}
      {services && searching ? (
        found.length === 0 ? <Notice title="Nothing matches" body="Try another word." /> : <View style={{gap:12}}>{found.map(card)}</View>
      ) : null}
      {services&&!searching&&level===1&&!grp?<ServiceHomes services={services} onReference={(referenceKey,coverage)=>router.push({pathname:"/(tabs)/quote-request",params:{referenceKey,...(coverage?{coverage}:{})}})} onOpen={s=>router.push(`/(tabs)/catalogue/${s.id}`)} priceLabel={s=>careEntryPrice(pricedLabel(s),!!pricingVehicle.category)}/>:null}
      {services && !searching && level === 1 && grp ? (
        <View style={{ gap: 18 }}>
          {grp==='ppf'?<PpfSelection services={all} priceLabel={s=>careEntryPrice(pricedLabel(s),!!pricingVehicle.category)} onService={s=>router.push(`/(tabs)/catalogue/${s.id}`)} onEnquiry={(id,request)=>router.push(request?{pathname:'/(tabs)/quote-request',params:{referenceKey:id,coverage:request}}:{pathname:'/(tabs)/catalogue/enquiry',params:{id}})}/>:visibleGroups.filter((g) => !grp || g.key === grp).map((g) => (
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
          {cat === 'ppf' ? <PpfSelection services={all} initialBrand={trail.find(crumb=>['XPEL','Garware','LLumar','3M','GSWF','NAR','AVVYX'].includes(crumb.key))?.key} priceLabel={s=>careEntryPrice(pricedLabel(s),!!pricingVehicle.category)} onService={s=>router.push(`/(tabs)/catalogue/${s.id}`)} onEnquiry={(id,request)=>router.push(request?{pathname:'/(tabs)/quote-request',params:{referenceKey:id,coverage:request}}:{pathname:'/(tabs)/catalogue/enquiry',params:{id}})}/> : renderNodes(nodes)}
          {cat === "ppf" || cat === "coatings" ? <T role="caption" tone="secondary">{cat === "coatings" ? "Final price confirmed after inspection." : PAINT_INSPECTION_NOTE}</T> : null}
        </View>
      ) : null}
      </View>

    </Screen>
  );
}
